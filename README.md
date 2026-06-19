# DevOpsBoard - Gestion Agile Scrum

Application web complète inspirée de Jira / Azure DevOps pour gérer:
- Projets Scrum
- Sprints
- User Stories
- Tâches
- Tableau visuel de sprint (To Do / In Progress / Done)
- Progression de sprint en pourcentage

## Stack technique

- **Frontend**: React + Vite
- **Backend**: Node.js + Express (API REST CRUD)
- **Base de données**: SQL Server (locale)

## Démarrage en local

### Prérequis
- **Node.js** 20+
- **SQL Server** (instalé localement)

### 1) Configuration Backend

```bash
cd backend
cp .env.example .env
```

Ouvrir `backend/.env` et configurer la connexion SQL Server:
```env
PORT=4000
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=DevOpsBoard
DB_USER=sa
DB_PASSWORD=YourPassword
DB_ENCRYPT=false
```

### 2) Lancer Backend

```bash
cd backend
npm install
npm run dev
```

L'API démarre sur `http://localhost:4000`

### 3) Lancer Frontend

Depuis la racine du projet:
```bash
npm install
npm run dev
```

Le frontend est accessible sur `http://localhost:5173`

## Endpoints REST (CRUD)

### Projets
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

### Sprints
- `GET /api/sprints`
- `GET /api/sprints/:id`
- `POST /api/sprints`
- `PUT /api/sprints/:id`
- `DELETE /api/sprints/:id`

### User Stories
- `GET /api/stories`
- `GET /api/stories/:id`
- `POST /api/stories`
- `PUT /api/stories/:id`
- `DELETE /api/stories/:id`

### Tâches
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Santé API
- `GET /api/health`
