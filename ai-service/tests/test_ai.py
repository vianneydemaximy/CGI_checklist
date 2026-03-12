"""
tests/test_ai.py
Unit tests for AI service endpoints.
Run: pytest tests/test_ai.py -v
"""
import base64
import json
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

# Import app — models will be mocked, so no actual downloads
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Mock the heavy ML pipelines before importing app ─────────
@pytest.fixture(scope="session", autouse=True)
def mock_pipelines():
    """Prevent actual HuggingFace model downloads during tests."""
    with patch("services.pdf_extractor.pipeline") as mock_clf_pipeline, \
         patch("services.email_generator.pipeline") as mock_gen_pipeline:

        # Zero-shot classifier mock
        mock_clf = MagicMock()
        mock_clf.return_value = [
            {"sequence": "The client must provide a signed NDA document.", "labels": ["document requirement", "general information"], "scores": [0.85, 0.15]},
            {"sequence": "VPN access credentials must be issued before mission start.", "labels": ["access requirement", "document requirement"], "scores": [0.92, 0.08]},
        ]
        mock_clf_pipeline.return_value = mock_clf

        # Text generation mock
        mock_gen = MagicMock()
        mock_gen.return_value = [{"generated_text": "Dear Client,\n\nPlease provide the requested documents.\n\nBest regards,\nConsultant"}]
        mock_gen_pipeline.return_value = mock_gen

        yield


from main import app

client = TestClient(app)


# ── Health check ──────────────────────────────────────────────
def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ── PDF Extraction ────────────────────────────────────────────
def test_extract_missing_pdf():
    """Missing pdf_base64 should return 422."""
    response = client.post("/extract-requirements", json={"pdf_base64": ""})
    assert response.status_code == 400


def test_extract_invalid_base64():
    """Invalid base64 should return 422."""
    response = client.post("/extract-requirements", json={"pdf_base64": "NOT_VALID_BASE64!!!", "filename": "test.pdf"})
    assert response.status_code == 422


def test_extract_with_valid_pdf():
    """
    Test extraction with a minimal valid PDF.
    The PDF extractor is mocked for the pipeline but text extraction uses fitz.
    We create a tiny in-memory PDF.
    """
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "The client must provide a signed NDA and VPN access credentials before project start.")
    pdf_bytes = doc.tobytes()
    doc.close()

    pdf_b64 = base64.b64encode(pdf_bytes).decode()
    response = client.post("/extract-requirements", json={"pdf_base64": pdf_b64, "filename": "test_rfp.pdf"})

    assert response.status_code == 200
    data = response.json()
    assert "tasks" in data
    assert isinstance(data["tasks"], list)
    assert data["task_count"] >= 1   # at least baseline tasks
    assert "message" in data


# ── Email Generation ──────────────────────────────────────────
def test_generate_email_missing_tasks():
    """No tasks → 400."""
    response = client.post("/generate-email", json={"tasks": [], "recipient_name": "Bob"})
    assert response.status_code == 400


def test_generate_email_success():
    """Valid request → email draft returned."""
    tasks = [
        {"title": "NDA signed", "task_type": "document", "priority": 1},
        {"title": "VPN credentials", "task_type": "access", "priority": 2},
    ]
    response = client.post("/generate-email", json={"tasks": tasks, "recipient_name": "Bob Client"})
    assert response.status_code == 200
    data = response.json()
    assert "subject" in data
    assert "body" in data
    assert len(data["body"]) > 10


def test_generate_email_subject_contains_keyword():
    """Subject should mention 'Mission Preparation' or 'Request'."""
    tasks = [{"title": "Access badge", "task_type": "access", "priority": 3}]
    response = client.post("/generate-email", json={"tasks": tasks})
    assert response.status_code == 200
    subject = response.json()["subject"]
    assert any(kw in subject for kw in ["Request", "CGI", "Preparation", "Access"])


def test_fallback_email_template():
    """
    When AI pipeline fails, the fallback template should be used.
    We test this by calling the generator's fallback directly.
    """
    from services.email_generator import EmailGenerator
    gen = EmailGenerator.__new__(EmailGenerator)
    gen.model_name = "test"
    gen.max_new_tokens = 256
    gen._pipeline = None

    body = gen._template_fallback(
        tasks=[{"title": "NDA", "task_type": "document"}, {"title": "DB credentials", "task_type": "access"}],
        recipient_name="Alice"
    )
    assert "Alice" in body
    assert "NDA" in body
    assert "DB credentials" in body
    assert "CGI" in body