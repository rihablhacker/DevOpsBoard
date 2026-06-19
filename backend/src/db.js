import dotenv from 'dotenv'
import sql from 'mssql'

dotenv.config()

const databaseName = process.env.DB_DATABASE || 'DevOpsBoard'

const baseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true, // Requis pour Docker
  },
}

let adminPool
let appPool

const adminConfig = { ...baseConfig, database: 'master' }
const appConfig = { ...baseConfig, database: databaseName }

// Fonction de temporisation pour attendre la DB
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getPool() {
  if (!appPool) {
    appPool = await new sql.ConnectionPool(appConfig).connect()
  }
  return appPool
}

async function getAdminPool() {
  let retries = 10 // On tente 10 fois maximum
  while (retries > 0) {
    try {
      if (!adminPool) {
        adminPool = await new sql.ConnectionPool(adminConfig).connect()
      }
      return adminPool
    } catch (err) {
      console.log(`[Docker-DB] En attente de SQL Server... (${retries} tentatives restantes)`)
      retries--
      await delay(2000) // On attend 2 secondes avant de réessayer
    }
  }
  throw new Error("Impossible de se connecter à SQL Server après plusieurs tentatives.")
}

export async function initializeDatabase() {
  console.log("[Docker-DB] Initialisation de la base de données...")
  const adminConnection = await getAdminPool()

  // Création de la base de données si elle n'existe pas
  await adminConnection.request().query(`
    IF DB_ID('${databaseName}') IS NULL
    BEGIN
      CREATE DATABASE [${databaseName}]
    END
  `)

  console.log(`[Docker-DB] Base [${databaseName}] prête. Création des tables...`)

  // Utilisation et création des tables
  await adminConnection.request().query(`
    USE [${databaseName}]

    IF OBJECT_ID('users', 'U') IS NULL
    BEGIN
      CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        password NVARCHAR(100) NOT NULL,
        role NVARCHAR(50) NOT NULL
      )
    END

    IF NOT EXISTS (SELECT 1 FROM users)
    BEGIN
      INSERT INTO users (name, email, password, role)
      VALUES
      ('Sara', 'scrum@demo.com', '1234', 'SCRUM_MASTER'),
      ('Yassine', 'po@demo.com', '1234', 'PRODUCT_OWNER'),
      ('Adam', 'dev@demo.com', '1234', 'DEVELOPER'),
      ('Nora', 'test@demo.com', '1234', 'TESTER')
    END

    IF OBJECT_ID('projects', 'U') IS NULL
    BEGIN
      CREATE TABLE projects (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        description NVARCHAR(MAX) NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    END

    IF OBJECT_ID('sprints', 'U') IS NULL
    BEGIN
      CREATE TABLE sprints (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        name NVARCHAR(150) NOT NULL,
        goal NVARCHAR(MAX) NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'PLANNED',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_sprints_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    END

    IF OBJECT_ID('user_stories', 'U') IS NULL
    BEGIN
      CREATE TABLE user_stories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        sprint_id INT NULL,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NULL,
        priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        story_points INT NOT NULL DEFAULT 3,
        status NVARCHAR(30) NOT NULL DEFAULT 'TODO',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_stories_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_stories_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
      )
    END

    IF OBJECT_ID('tasks', 'U') IS NULL
    BEGIN
      CREATE TABLE tasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_story_id INT NOT NULL,
        sprint_id INT NULL,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NULL,
        state NVARCHAR(20) NOT NULL DEFAULT 'TODO',
        assignee NVARCHAR(120) NULL,
        estimated_hours INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_tasks_story FOREIGN KEY (user_story_id) REFERENCES user_stories(id) ON DELETE CASCADE,
        CONSTRAINT fk_tasks_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
      )
    END
  `)
  
  console.log("[Docker-DB] Base de données initialisée avec succès ! ✅")
}

export { sql }