-- ============================================================
-- AI Document Orchestrator — Database Schema
-- MySQL compatible (tested with XAMPP 8.x)
-- ============================================================

-- Init debug

SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS ai_doc_orchestrator
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_doc_orchestrator;

-- ──────────────────────────────────────────────────────────────
-- ROLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)  NOT NULL UNIQUE,   -- 'consultant' | 'client' | 'admin'
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO roles (name) VALUES ('admin'), ('consultant'), ('client');

-- ──────────────────────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT           NOT NULL AUTO_INCREMENT,
  role_id       INT           NOT NULL,
  name          VARCHAR(150)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- ──────────────────────────────────────────────────────────────
-- PROJECTS  (one consulting mission = one project)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id           INT          NOT NULL AUTO_INCREMENT,
  consultant_id INT         NOT NULL,
  client_id    INT,                          -- optional linked client user
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  status       ENUM('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (consultant_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (client_id)    REFERENCES users(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- TEMPLATES  (reusable checklist blueprints)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE templates (
  id          INT          NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_by  INT          NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE template_items (
  id           INT          NOT NULL AUTO_INCREMENT,
  template_id  INT          NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  task_type    ENUM('document','access','information','authorization') NOT NULL DEFAULT 'document',
  priority     INT          NOT NULL DEFAULT 5,   -- 1 (high) to 10 (low)
  sort_order   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- CHECKLISTS  (one per project, can have multiple in future)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE checklists (
  id           INT          NOT NULL AUTO_INCREMENT,
  project_id   INT          NOT NULL,
  title        VARCHAR(255) NOT NULL,
  source       ENUM('manual','template','ai') NOT NULL DEFAULT 'manual',
  ai_validated TINYINT(1)  NOT NULL DEFAULT 0,   -- human confirmed AI draft
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- TASKS  (items inside a checklist)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id              INT          NOT NULL AUTO_INCREMENT,
  checklist_id    INT          NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  task_type       ENUM('document','access','information','authorization') NOT NULL DEFAULT 'document',
  priority        INT          NOT NULL DEFAULT 5,
  status          ENUM('pending','requested','received','validated') NOT NULL DEFAULT 'pending',
  assigned_to_email VARCHAR(255),             -- client email expected to deliver
  sort_order      INT          NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- DOCUMENTS  (uploaded files linked to tasks)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id          INT          NOT NULL AUTO_INCREMENT,
  task_id     INT          NOT NULL,
  uploaded_by INT          NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(100),
  file_data   LONGBLOB     NOT NULL,          -- V1: store in DB
  file_size   INT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (task_id)     REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- versioning: each new upload to same task = new row, latest by created_at
-- document_versions view for convenience
CREATE VIEW document_versions AS
  SELECT
    d.*,
    t.title AS task_title,
    t.checklist_id,
    u.name  AS uploader_name
  FROM documents d
  JOIN tasks    t ON t.id = d.task_id
  JOIN users    u ON u.id = d.uploaded_by;

-- ──────────────────────────────────────────────────────────────
-- EMAILS  (outbound email records)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE emails (
  id            INT          NOT NULL AUTO_INCREMENT,
  project_id    INT          NOT NULL,
  sent_by       INT          NOT NULL,
  recipient     VARCHAR(255) NOT NULL,
  subject       VARCHAR(500) NOT NULL,
  body          TEXT         NOT NULL,
  status        ENUM('draft','sent','failed') NOT NULL DEFAULT 'draft',
  sent_at       DATETIME,
  task_ids      JSON,                        -- array of task IDs covered
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by)    REFERENCES users(id)    ON DELETE RESTRICT
);

-- ──────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     INT,
  action      VARCHAR(100) NOT NULL,         -- e.g. 'task.status_changed'
  entity_type VARCHAR(50)  NOT NULL,         -- e.g. 'task', 'document', 'email'
  entity_id   INT,
  details     JSON,                          -- arbitrary context
  ip_address  VARCHAR(45),
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
);

-- ──────────────────────────────────────────────────────────────
-- SEED DATA — default templates
-- ──────────────────────────────────────────────────────────────
INSERT INTO users (role_id, name, email, password_hash) VALUES
  (1, 'Admin', 'admin@cgi.com', '$2b$10$placeholder_change_this');
-- Note: run backend seed script to create real hashed passwords

INSERT INTO templates (name, description, created_by) VALUES
  ('Standard IT Mission', 'Typical documents required for an IT consulting mission', 1),
  ('Data Project', 'Documents for data engineering / analytics missions', 1);

INSERT INTO template_items (template_id, title, task_type, priority, sort_order) VALUES
  (1, 'NDA signed by client', 'document', 1, 1),
  (1, 'Statement of Work (SOW)', 'document', 1, 2),
  (1, 'VPN / Remote access credentials', 'access', 2, 3),
  (1, 'Active Directory account creation', 'authorization', 2, 4),
  (1, 'Project manager contact details', 'information', 3, 5),
  (1, 'IT security policy document', 'document', 3, 6),
  (1, 'Office access badge', 'access', 4, 7),
  (2, 'Data access agreement', 'document', 1, 1),
  (2, 'Database connection credentials', 'access', 1, 2),
  (2, 'Data dictionary / catalog', 'document', 2, 3),
  (2, 'Compliance/GDPR officer contact', 'information', 2, 4),
  (2, 'Data retention policy document', 'document', 3, 5);

  -- Fin debug

  SET FOREIGN_KEY_CHECKS = 1;