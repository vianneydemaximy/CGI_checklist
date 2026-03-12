"""
main.py — AI Service entry point (FastAPI)

Endpoints:
  POST /extract-requirements  — analyze RFP PDF, return checklist task draft
  POST /generate-email        — generate professional email draft from tasks
  GET  /health                — liveness check

Environment variables (see .env.example):
  EXTRACTION_MODEL  — HuggingFace model for zero-shot classification
  EMAIL_MODEL       — HuggingFace model for text generation
  MAX_NEW_TOKENS    — max tokens for email generation (default: 512)
  PORT              — service port (default: 8000)
"""
import logging
import os
from typing import List, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.pdf_extractor import PdfExtractor
from services.email_generator import EmailGenerator

load_dotenv()

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(
    title="AI Document Orchestrator — AI Service",
    description="Provides PDF requirement extraction and email generation using open-source HuggingFace models.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],   # Backend only
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singleton model instances (lazy-loaded on first request) ──
extractor = PdfExtractor(
    model_name=os.getenv("EXTRACTION_MODEL", "facebook/bart-large-mnli")
)
generator = EmailGenerator(
    model_name=os.getenv("EMAIL_MODEL", "google/flan-t5-base"),
    max_new_tokens=int(os.getenv("MAX_NEW_TOKENS", "512")),
)

# ── Request / Response models ─────────────────────────────────

class ExtractRequest(BaseModel):
    pdf_base64: str            # Base64-encoded PDF content
    filename: Optional[str] = "document.pdf"

class TaskItem(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "document"   # document | access | information | authorization
    priority: int = 5

class ExtractResponse(BaseModel):
    tasks: List[TaskItem]
    task_count: int
    message: str

# ──────────────────────────────────────────────────────────────

class GenerateEmailRequest(BaseModel):
    tasks: List[dict]
    recipient_name: Optional[str] = "Client"
    project_id: Optional[int] = None

class GenerateEmailResponse(BaseModel):
    subject: str
    body: str
    message: str

# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    """Liveness check."""
    return {"status": "ok", "service": "ai-service"}


@app.post("/extract-requirements", response_model=ExtractResponse)
def extract_requirements(req: ExtractRequest):
    """
    Accept a base64-encoded RFP PDF and return a draft list of tasks
    representing likely required documents, accesses, and authorizations.

    This is a PROPOSAL — the consultant must validate before saving.
    """
    logger.info(f"Received extraction request for file: {req.filename}")

    if not req.pdf_base64:
        raise HTTPException(status_code=400, detail="pdf_base64 is required")

    try:
        raw_tasks = extractor.extract(req.pdf_base64)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Extraction failed")
        raise HTTPException(status_code=500, detail=f"Extraction error: {str(e)}")

    tasks = [TaskItem(**t) for t in raw_tasks]
    return ExtractResponse(
        tasks=tasks,
        task_count=len(tasks),
        message=f"Extracted {len(tasks)} tasks from {req.filename}. Review and validate before saving.",
    )


@app.post("/generate-email", response_model=GenerateEmailResponse)
def generate_email(req: GenerateEmailRequest):
    """
    Generate a professional email draft requesting listed items from a client.
    The result is a DRAFT — it must be reviewed and confirmed by the consultant
    before any actual email is sent (human-in-the-loop).
    """
    logger.info(f"Email generation request: {len(req.tasks)} tasks, recipient: {req.recipient_name}")

    if not req.tasks:
        raise HTTPException(status_code=400, detail="At least one task is required")

    try:
        result = generator.generate(tasks=req.tasks, recipient_name=req.recipient_name)
    except Exception as e:
        logger.exception("Email generation failed")
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")

    return GenerateEmailResponse(
        subject=result["subject"],
        body=result["body"],
        message="Email draft generated — review and confirm before sending.",
    )


# ── Entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)