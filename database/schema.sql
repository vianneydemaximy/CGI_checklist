DROP DATABASE IF EXISTS ai_doc_orchestrator;
CREATE DATABASE ai_doc_orchestrator;
USE ai_doc_orchestrator;

SET NAMES utf8mb4;

-- USERS / ROLES

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- PROJECTS

CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consultant_id INT NOT NULL,
  client_id INT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('draft','active','completed','archived') DEFAULT 'draft',
  language VARCHAR(5) DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (consultant_id) REFERENCES users(id),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CHECKLISTS

CREATE TABLE checklists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  source ENUM('manual','template','ai') DEFAULT 'manual',
  ai_validated TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- TASKS

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checklist_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type ENUM('document','access','information','authorization') DEFAULT 'document',
  priority INT DEFAULT 5,
  status ENUM('pending','requested','received','validated') DEFAULT 'pending',
  assigned_to_email VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
);

-- DOCUMENTS

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_data LONGBLOB NOT NULL,
  file_size INT,
  is_current TINYINT(1) DEFAULT 1,
  version_number INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- EMAILS

CREATE TABLE emails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  sent_by INT NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('draft','sent','failed') DEFAULT 'draft',
  sent_at DATETIME,
  task_ids JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by) REFERENCES users(id)
);

-- EMAIL TEMPLATES

CREATE TABLE email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  is_global TINYINT(1) DEFAULT 0,
  created_by INT NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- CHECKLIST TEMPLATES

CREATE TABLE templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_global TINYINT(1) DEFAULT 0,
  created_by INT NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE template_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type ENUM('document','access','information','authorization') DEFAULT 'document',
  priority INT DEFAULT 5,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- AUDIT LOGS

CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- VIEW

CREATE VIEW document_versions AS
SELECT
d.id,
d.task_id,
d.uploaded_by,
d.filename,
d.mime_type,
d.file_data,
d.file_size,
d.created_at,
t.title AS task_title,
t.checklist_id,
u.name AS uploader_name
FROM documents d
JOIN tasks t ON t.id = d.task_id
JOIN users u ON u.id = d.uploaded_by;