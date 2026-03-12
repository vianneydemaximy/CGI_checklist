"""
services/email_generator.py

Generates professional consulting emails using google/flan-t5-base.
The model is instruction-tuned, making it well-suited for structured
text generation from prompts without fine-tuning.

The generated email is returned as a DRAFT — never sent automatically.
"""
import logging
from typing import List, Dict, Any

from transformers import pipeline

logger = logging.getLogger(__name__)

# Task type → human-readable action phrasing
TASK_TYPE_PHRASES = {
    "document":      "provide the following document(s)",
    "access":        "grant the following access/credentials",
    "authorization": "complete the following authorization steps",
    "information":   "share the following information",
}


class EmailGenerator:
    """
    Generates professional consulting email drafts.
    Lazy-loads the text generation model on first use.
    """

    def __init__(self, model_name: str = "google/flan-t5-base", max_new_tokens: int = 512):
        self.model_name = model_name
        self.max_new_tokens = max_new_tokens
        self._pipeline = None
        logger.info(f"EmailGenerator initialized with model: {model_name}")

    def _get_pipeline(self):
        if self._pipeline is None:
            logger.info(f"Loading email generation model: {self.model_name}...")
            self._pipeline = pipeline(
                "text2text-generation",
                model=self.model_name,
                device=-1,   # CPU
            )
            logger.info("Email model loaded.")
        return self._pipeline

    def _group_tasks_by_type(self, tasks: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """Group task titles by their task_type for structured email body."""
        groups: Dict[str, List[str]] = {}
        for task in tasks:
            ttype = task.get("task_type", "document")
            groups.setdefault(ttype, []).append(task["title"])
        return groups

    def _build_prompt(self, tasks: List[Dict[str, Any]], recipient_name: str) -> str:
        """
        Build an instruction prompt for flan-t5 to generate the email body.
        The model responds well to explicit instruction prompts.
        """
        grouped = self._group_tasks_by_type(tasks)
        items_summary = []
        for ttype, titles in grouped.items():
            items_summary.append(f"{TASK_TYPE_PHRASES.get(ttype, 'provide')}: " + ", ".join(titles))

        items_text = "; ".join(items_summary)

        prompt = (
            f"Write a professional consulting email to {recipient_name} requesting the following items "
            f"for an upcoming consulting mission: {items_text}. "
            f"The tone should be polite, clear, and professional. "
            f"Include a brief introduction, a numbered list of requested items, "
            f"a clear deadline mention (to be filled by consultant), and a professional closing."
        )
        return prompt

    def _build_subject(self, tasks: List[Dict[str, Any]]) -> str:
        """Generate a contextual email subject line."""
        types = list({t.get("task_type", "document") for t in tasks})
        if len(types) == 1:
            type_str = {"document": "Document", "access": "Access", "information": "Information", "authorization": "Authorization"}.get(types[0], "Item")
            return f"[CGI Mission Preparation] {type_str} Request"
        return "[CGI Mission Preparation] Document and Access Request"

    def generate(self, tasks: List[Dict[str, Any]], recipient_name: str = "Client") -> Dict[str, str]:
        """
        Generate a professional email draft.
        Returns { subject: str, body: str }
        """
        if not tasks:
            raise ValueError("At least one task is required to generate an email")

        subject = self._build_subject(tasks)

        try:
            gen = self._get_pipeline()
            prompt = self._build_prompt(tasks, recipient_name)
            result = gen(prompt, max_new_tokens=self.max_new_tokens, do_sample=False)
            ai_body = result[0]["generated_text"].strip()
        except Exception as e:
            logger.warning(f"AI model generation failed: {e}. Using template fallback.")
            ai_body = self._template_fallback(tasks, recipient_name)

        return {"subject": subject, "body": ai_body}

    def _template_fallback(self, tasks: List[Dict[str, Any]], recipient_name: str) -> str:
        """
        Rule-based email template used when the AI model fails or is unavailable.
        Always produces a clean, professional draft.
        """
        grouped = self._group_tasks_by_type(tasks)

        sections = []
        item_counter = 1
        for ttype, titles in grouped.items():
            phrase = TASK_TYPE_PHRASES.get(ttype, "provide")
            sections.append(f"Could you please {phrase}:")
            for title in titles:
                sections.append(f"  {item_counter}. {title}")
                item_counter += 1

        items_block = "\n".join(sections)

        return f"""Dear {recipient_name},

I hope this message finds you well.

As part of the preparation for our upcoming consulting mission, I am reaching out to request several items needed to ensure a smooth start to our collaboration.

{items_block}

Could you please provide these items by [INSERT DEADLINE]? If any item requires additional clarification or if you have questions, please do not hesitate to contact me directly.

Thank you in advance for your cooperation. We look forward to working with you.

Best regards,
[Consultant Name]
CGI
[Consultant Email]
[Consultant Phone]"""