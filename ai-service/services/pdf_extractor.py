"""
services/pdf_extractor.py

Extracts likely required documents from an RFP PDF using:
1. Text extraction with PyMuPDF (fitz) — lightweight, no ML needed.
2. Zero-shot classification with facebook/bart-large-mnli to identify
   which extracted sentences describe document requirements.
3. Pattern matching to infer standard follow-up documents.

Design principle: The AI proposes, the consultant validates (human-in-the-loop).
"""
import base64
import io
import re
import logging
from typing import List, Dict, Any

import fitz  # PyMuPDF
from transformers import pipeline
from .prioritizer import Prioritizer


logger = logging.getLogger(__name__)

# ── Candidate labels for zero-shot classification ─────────────
# These guide the model to identify document requirement sentences.
REQUIREMENT_LABELS = [
    "document requirement",
    "access requirement",
    "authorization requirement",
    "general information",
]

# ── Pattern-based standard follow-up documents ────────────────
# When certain keywords appear, we infer additional expected items.
STANDARD_PATTERNS: List[Dict[str, Any]] = [
    {
        "keywords": ["nda", "non-disclosure", "confidentiality"],
        "inferred": [
            {"title": "NDA signed by both parties", "task_type": "document", "priority": 1},
        ],
    },
    {
        "keywords": ["data", "database", "analytics", "bi", "reporting"],
        "inferred": [
            {"title": "Data access agreement", "task_type": "document", "priority": 1},
            {"title": "Database connection credentials", "task_type": "access", "priority": 2},
            {"title": "Data dictionary / catalog", "task_type": "document", "priority": 3},
        ],
    },
    {
        "keywords": ["cloud", "aws", "azure", "gcp", "kubernetes", "docker"],
        "inferred": [
            {"title": "Cloud access credentials (IAM / service account)", "task_type": "access", "priority": 2},
            {"title": "Cloud architecture diagram", "task_type": "document", "priority": 3},
        ],
    },
    {
        "keywords": ["security", "compliance", "iso 27001", "soc 2", "gdpr"],
        "inferred": [
            {"title": "IT security policy document", "task_type": "document", "priority": 2},
            {"title": "Compliance officer contact", "task_type": "information", "priority": 3},
        ],
    },
    {
        "keywords": ["vpn", "remote", "access", "onboarding"],
        "inferred": [
            {"title": "VPN credentials and setup guide", "task_type": "access", "priority": 2},
            {"title": "Active Directory / SSO account creation", "task_type": "authorization", "priority": 2},
        ],
    },
]

# ── Always-included baseline tasks ────────────────────────────
BASELINE_TASKS = [
    {"title": "Statement of Work (SOW)", "task_type": "document", "priority": 1},
    {"title": "Project manager contact details", "task_type": "information", "priority": 3},
    {"title": "Office access badge (if on-site)", "task_type": "access", "priority": 5},
]


class PdfExtractor:
    """
    Loads the zero-shot classification model once and reuses it.
    The pipeline is lazy-loaded on first call to avoid slow startup.
    """

    def __init__(self, model_name: str = "facebook/bart-large-mnli"):
        self.model_name = model_name
        self._pipeline = None
        logger.info(f"PdfExtractor initialized with model: {model_name}")

    def _get_pipeline(self):
        """Lazy-load the zero-shot classification pipeline."""
        if self._pipeline is None:
            logger.info(f"Loading zero-shot model: {self.model_name} (first call only)...")
            self._pipeline = pipeline(
                "zero-shot-classification",
                model=self.model_name,
                # Use CPU for V1 cost efficiency
                device=-1,
            )
            logger.info("Model loaded successfully.")
        return self._pipeline

    def extract_text(self, pdf_bytes: bytes) -> str:
        """Extract plain text from a PDF."""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages_text = []
            for page in doc:
                pages_text.append(page.get_text())
            doc.close()
            return "\n".join(pages_text)
        except Exception as e:
            logger.error(f"PDF text extraction failed: {e}")
            raise ValueError(f"Could not read PDF: {e}")

    def find_requirement_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences and use zero-shot classification
        to find those describing document/access requirements.
        Returns list of relevant sentences (score > 0.5 for 'document requirement').
        """
        # Simple sentence split — adequate for RFP documents
        sentences = re.split(r'(?<=[.!?])\s+', text)
        # Filter out very short or very long sentences
        candidates = [s.strip() for s in sentences if 20 < len(s.strip()) < 300]

        if not candidates:
            return []

        try:
            clf = self._get_pipeline()
            # Batch classify to be faster
            results = clf(candidates[:80], REQUIREMENT_LABELS, batch_size=8)
            relevant = []
            for result in results:
                top_label = result["labels"][0]
                top_score = result["scores"][0]
                if top_label in ("document requirement", "access requirement", "authorization requirement") \
                        and top_score > 0.5:
                    relevant.append(result["sequence"])
            return relevant
        except Exception as e:
            logger.warning(f"Zero-shot classification failed: {e}. Falling back to pattern matching only.")
            return []

    def sentence_to_task(self, sentence: str, index: int) -> Dict[str, Any]:
        """Convert a classified sentence to a task dict."""
        # Infer task_type from keywords in sentence
        s_lower = sentence.lower()
        if any(k in s_lower for k in ["access", "credential", "password", "login", "account"]):
            task_type = "access"
        elif any(k in s_lower for k in ["authorize", "authorization", "permission", "grant"]):
            task_type = "authorization"
        elif any(k in s_lower for k in ["contact", "name", "phone", "email of"]):
            task_type = "information"
        else:
            task_type = "document"

        # Truncate long sentences for title
        title = sentence[:120].strip()
        if len(sentence) > 120:
            title = title[:title.rfind(" ")] + "…"

        return {
            "title": title,
            "description": sentence,
            "task_type": task_type,
            "priority": min(index + 2, 8),  # later items = lower priority
        }

    def apply_patterns(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect keywords in the full text and infer standard follow-up tasks.
        Returns deduplicated list of inferred tasks.
        """
        text_lower = text.lower()
        inferred = []
        seen_titles = set()

        for pattern in STANDARD_PATTERNS:
            if any(kw in text_lower for kw in pattern["keywords"]):
                for task in pattern["inferred"]:
                    if task["title"] not in seen_titles:
                        inferred.append(task)
                        seen_titles.add(task["title"])

        return inferred

    def extract(self, pdf_base64: str) -> List[Dict[str, Any]]:
        """
        Main entry point.
        1. Decode PDF from base64.
        2. Extract text.
        3. Classify requirement sentences.
        4. Apply pattern-based inference.
        5. Add baseline tasks.
        6. Return deduplicated, sorted task list.
        """
        # Decode PDF
        try:
            pdf_bytes = base64.b64decode(pdf_base64)
        except Exception:
            raise ValueError("Invalid base64 PDF data")

        text = self.extract_text(pdf_bytes)

        # AI classified tasks
        relevant_sentences = self.find_requirement_sentences(text)
        ai_tasks = [self.sentence_to_task(s, i) for i, s in enumerate(relevant_sentences)]

        # Pattern-inferred tasks
        pattern_tasks = self.apply_patterns(text)

        # Combine: baseline first, then AI tasks, then pattern-inferred
        all_tasks = []
        seen = set()

        for task in BASELINE_TASKS + ai_tasks + pattern_tasks:
            key = task["title"].lower()[:60]
            if key not in seen:
                all_tasks.append(task)
                seen.add(key)

        # Sort by priority ascending (1 = highest) (without prioritizer.py)
        #all_tasks.sort(key=lambda t: t.get("priority", 5))
        
        all_tasks = Prioritizer().sort_and_score(all_tasks)

        logger.info(f"Extraction complete: {len(ai_tasks)} AI tasks + {len(pattern_tasks)} pattern tasks + {len(BASELINE_TASKS)} baseline = {len(all_tasks)} total")
        return all_tasks