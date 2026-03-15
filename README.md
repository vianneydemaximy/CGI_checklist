# AI Document Orchestrator — Consultant Checklist Assistant

> Internal tool for CGI consultants to automate document and access collection before a mission starts.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (React + Vite)                │
│                   Port: 5173 (dev)                      │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (/api/*)
                         ▼
┌─────────────────────────────────────────────────────────┐
│               Backend (Node.js + Express)               │
│               Port: 4000                                │
│  · Auth (JWT)    · CRUD API    · Email (SMTP)           │
│  · Audit logs    · File uploads · Role-based access     │
└──────────┬─────────────────────────────┬────────────────┘
           │ MySQL (mysql2)              │ HTTP (axios)
           ▼                             ▼
┌──────────────────────┐  ┌─────────────────────────────┐
│  MySQL Database      │  │  AI Service (FastAPI)        │
│  Port: 3306          │  │  Port: 8000                  │
│  (XAMPP compatible)  │  │  · PDF requirement extract   │
│                      │  │  · Email draft generation    │
│                      │  │  · HuggingFace models (free) │
└──────────────────────┘  └─────────────────────────────┘
```

### Services Communication

| From       | To          | Protocol | Purpose                        |
|------------|-------------|----------|--------------------------------|
| Frontend   | Backend     | REST API | All app operations             |
| Backend    | MySQL       | TCP      | Data persistence               |
| Backend    | AI Service  | HTTP     | PDF extraction, email drafts   |
| Backend    | SMTP server | SMTP     | Real email sending             |

---

## Repository Structure

```
root/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express app config
│   │   ├── server.js                 # Entry point
│   │   ├── config/
│   │   │   ├── db.js                 # MySQL pool
│   │   │   └── email.js              # SMTP transporter
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT + role guards
│   │   │   └── audit.js              # Audit log writer
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── projectController.js
│   │   │   ├── checklistController.js
│   │   │   ├── taskController.js
│   │   │   ├── documentController.js
│   │   │   ├── emailController.js
│   │   │   ├── templateController.js
│   │   │   └── historyController.js
│   │   ├── routes/                   # Express routers
│   │   └── utils/
│   │       └── seed.js               # Default users
│   ├── tests/
│   │   └── api.test.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   # Router
│   │   ├── styles/global.css
│   │   ├── context/AuthContext.jsx
│   │   ├── services/api.js
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── TaskItem.jsx
│   │   │   └── EmailModal.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── ChecklistView.jsx
│   │       └── History.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── ai-service/
│   ├── main.py                       # FastAPI entry point
│   ├── services/
│   │   ├── pdf_extractor.py          # PDF → tasks
│   │   └── email_generator.py        # tasks → email draft
│   ├── tests/
│   │   └── test_ai.py
│   ├── requirements.txt
│   └── .env
│
├── database/
│   └── schema.sql                    # Full MySQL schema + seed data
│
└── README.md
```

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js     | ≥ 18    | Backend + Frontend |
| Python      | ≥ 3.10  | AI service |
| MySQL       | ≥ 8.0   | XAMPP or standalone |
| SMTP access | —       | Gmail App Password works |

---

## Setup & Installation


### 1. Fichier .env
Create a .env file at the root of backend and ai-service and fill it with your informations (email, db password, etc...)

### 1. Database

Start MySQL (XAMPP or standalone), then run:

```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend

```bash
cd backend

# Install dependencies
npm install



# Create hashed user accounts
npm run seed

# Start (development mode with hot reload)
npm run dev
# → http://localhost:4000
```

### 3. AI Service

```bash
cd ai-service

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt



# Start service
python main.py
# → http://localhost:8000
# First extraction request downloads the models (~1.5 GB total)
```

**Model storage**: HuggingFace models are cached in `~/.cache/huggingface`. Override with `HF_HOME=/your/path`.

### 4. Frontend

```bash
cd frontend

npm install

# Start dev server
npm run dev
# → http://localhost:5173
```

---

## Default Credentials (after seed)

| Email                  | Password    | Role       |
|------------------------|-------------|------------|
| admin@cgi.com          | Admin123!   | admin      |
| alice@cgi.com          | Consult123! | consultant |

⚠️ Change all passwords before any production use.

---

## Environment Variables

### Backend `.env`

```env
PORT=4000
NODE_ENV=development

# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ai_doc_orchestrator
DB_USER=root
DB_PASSWORD=

# JWT
JWT_SECRET=change_this_long_random_string
JWT_EXPIRES_IN=8h

# SMTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="CGI Tool <your@gmail.com>"

# AI Service
AI_SERVICE_URL=http://localhost:8000

# CORS
FRONTEND_URL=http://localhost:5173
```

### AI Service `.env`

```env
PORT=8000
EXTRACTION_MODEL=facebook/bart-large-mnli
EMAIL_MODEL=google/flan-t5-base
MAX_NEW_TOKENS=512
LOG_LEVEL=info
```

---

## API Reference

### Authentication
| Method | Endpoint          | Body                   | Response          |
|--------|-------------------|------------------------|-------------------|
| POST   | /api/auth/login   | { email, password }    | { token, user }   |
| GET    | /api/auth/me      | —                      | user object       |

### Projects
| Method | Endpoint           | Role      |
|--------|--------------------|-----------|
| GET    | /api/projects      | all       |
| POST   | /api/projects      | consultant |
| GET    | /api/projects/:id  | all       |
| PUT    | /api/projects/:id  | consultant |
| DELETE | /api/projects/:id  | consultant |

### Checklists
| Method | Endpoint                                              | Notes                    |
|--------|-------------------------------------------------------|--------------------------|
| GET    | /api/projects/:id/checklists                          | With completion stats    |
| POST   | /api/projects/:id/checklists                          | manual or template       |
| POST   | /api/projects/:id/checklists/ai-extract               | PDF upload → draft       |
| POST   | /api/projects/:id/checklists/ai-validate              | Save validated AI draft  |

### Tasks
| Method | Endpoint                           |
|--------|------------------------------------|
| GET    | /api/checklists/:id/tasks          |
| POST   | /api/checklists/:id/tasks          |
| PUT    | /api/tasks/:id                     |
| DELETE | /api/tasks/:id                     |
| PATCH  | /api/tasks/:id/status              |

### Documents
| Method | Endpoint                           | Notes                        |
|--------|------------------------------------|------------------------------|
| GET    | /api/tasks/:id/documents           | All versions                 |
| POST   | /api/tasks/:id/documents           | Upload file (multipart)      |
| GET    | /api/documents/:id/download        | Stream file                  |
| DELETE | /api/documents/:id                 | Consultant only              |

### Emails
| Method | Endpoint                                   | Notes                            |
|--------|--------------------------------------------|----------------------------------|
| POST   | /api/projects/:id/emails/generate          | AI draft (NOT sent)              |
| POST   | /api/emails/:id/send                       | Human-validated send             |
| GET    | /api/projects/:id/emails                   | Email history                    |

---

## Running Tests

```bash
# Backend
cd backend && npm test

# AI service
cd ai-service && pytest tests/ -v
```

---

## GDPR & Compliance Decisions

This section documents every privacy-related design decision.

### ✅ Email Monitoring (NOT implemented in V1)
The spec mentions monitoring inbound emails to auto-detect received documents. **V1 deliberately omits automatic mailbox scanning** because:
- Reading email metadata from a client mailbox requires explicit consent and a legal basis under GDPR Art. 6.
- Automation without consent could violate GDPR and corporate data processing agreements.

**V1 approach**: Task status is updated manually by the consultant, or automatically when a client uploads a document through the portal.

### ✅ No Tracking Pixels
The email sender (`config/email.js`) generates plain-text and clean HTML emails. No tracking pixels, open-tracking URLs, or read-receipt mechanisms are included. This is hardcoded — not configurable — to prevent accidental GDPR violations.

### ✅ Audit Logs vs. Content Logging
- `audit_logs` stores **metadata only**: who did what, when, and to which entity.
- Email **body content is NOT stored in audit logs** (only metadata: recipient, subject, task count).
- Document **file content is NOT logged** — only filename, size, uploader.

### ✅ Document Content Not Read by AI
The PDF extraction service reads uploaded RFP documents for the purpose of generating a task checklist. Client documents uploaded as deliverables are **never sent to the AI service**. The AI only processes RFP PDFs explicitly uploaded by the consultant.

### ✅ Data Minimization
- Client users can only view their assigned project checklist and upload documents.
- Clients cannot access other projects, email history, or audit logs.

### ✅ Human Validation at Every Step
- AI checklist drafts are presented for review — not auto-saved.
- Email drafts are presented for editing — not auto-sent.
- Document uploads update task status automatically but consultants can override.

### ✅ Password Security
- Passwords hashed with bcrypt (cost factor 10).
- Plain-text passwords never stored or logged.
- JWT tokens expire after 8 hours (configurable).

### ⚠️ V1 Limitations (to address before production)
1. Files stored as BLOBs in MySQL — migrate to object storage (S3/MinIO) for scale.
2. No email encryption (TLS in transit via SMTP only).
3. No MFA/2FA.
4. Rate limiting is IP-based only — add user-level limiting.
5. SMTP credentials should use a dedicated service account, not personal Gmail.

---

## Human-in-the-Loop Design

This tool is deliberately **not autonomous**:

| Feature              | Human action required              |
|----------------------|------------------------------------|
| AI checklist draft   | Consultant reviews & validates     |
| Email draft          | Consultant reviews & explicitly sends |
| Task status          | Manually updated or triggered by upload |
| Document validation  | Consultant marks as 'validated'    |

The system assists consultants — it does not act on their behalf without explicit confirmation.

---

## Technology Choices

| Component  | Technology        | Rationale |
|------------|-------------------|-----------|
| Backend    | Node.js + Express | Lightweight, familiar to most web developers, excellent async I/O |
| Database   | MySQL             | XAMPP-compatible, widely known, good relational structure |
| Auth       | JWT (jsonwebtoken)| Stateless, simple, compatible with mobile |
| Email      | Nodemailer        | Battle-tested SMTP library |
| AI Extraction | facebook/bart-large-mnli | Open-source, runs on CPU, zero-shot classification |
| AI Email   | google/flan-t5-base | Open-source, instruction-tuned, good for structured generation |
| Frontend   | React + Vite      | Fast DX, small bundle, industry standard |
| Styling    | Custom CSS        | No framework dependency, full control |