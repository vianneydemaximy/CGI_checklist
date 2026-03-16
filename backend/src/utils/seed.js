const pool = require("../config/db");

async function seed() {

console.log("Seeding database...");

await pool.query(`
INSERT INTO roles (id,name) VALUES
(1,'admin'),
(2,'consultant'),
(3,'client')
`);

await pool.query(`
INSERT INTO users (id,role_id,name,email,password_hash)
VALUES
(1,1,'Admin','admin@cgi.com','$2b$10$2jgNnXJ1e7itJQHCVmAHDuksW.F/A0TTpga5NzK3q.X8BylZQrx/2'),
(2,2,'Alice Consultant','alice@cgi.com','$2a$10$uWjGgeAD0pLk80TwD1ba5eqjexxH2lPPHU15ERpzuydEBPNCvXtNi')
`);

await pool.query(`
INSERT INTO templates (name,description,is_global,created_by,language)
VALUES
('Data Project','Documents for data engineering missions',1,1,'en'),
('Projet Data','Template mission data',1,1,'fr')
`);

await pool.query(`
INSERT INTO template_items (template_id,title,task_type,priority,sort_order)
VALUES
(1,'Data access agreement','document',1,0),
(1,'Database connection credentials','access',1,1),
(1,'Data dictionary / catalog','document',2,2),
(1,'Compliance/GDPR officer contact','information',2,3),
(1,'Data retention policy document','document',3,4)
`);

await pool.query(`
INSERT INTO email_templates
(name,description,subject,body,is_global,created_by,language)
VALUES
(
'Standard document request',
'Email to request documents',
'[CGI Mission Preparation] Document Request',
'Dear {{recipient_name}},\\n\\n{{task_list}}\\n\\nBest regards,\\n{{consultant_name}}',
1,
1,
'en'
)
`);

console.log("Seed complete");
process.exit();
}

seed();