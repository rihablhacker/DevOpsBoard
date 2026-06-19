# Cahier de charge - DevOpsBoard (Version 2)

## 1. Contexte et objectif
DevOpsBoard est une application web de gestion Agile Scrum, inspiree de Jira/Azure DevOps. Elle permet de gerer projets, sprints, user stories et taches, avec un tableau Scrum et un suivi visuel de l'avancement.

## 2. Perimetre fonctionnel (V2)
### 2.1 Authentification
- Connexion par email + mot de passe.
- Comptes de demo (SQL):
  - scrum@demo.com / 1234 (SCRUM_MASTER)
  - po@demo.com / 1234 (PRODUCT_OWNER)
  - dev@demo.com / 1234 (DEVELOPER)
  - test@demo.com / 1234 (TESTER)

### 2.2 Roles et permissions (Scrum reelles)
- Scrum Master:
  - Creer projet, sprint, taches
  - Assigner taches
  - Changer etat taches
  - Supprimer taches
  - Consulter dashboard
- Product Owner:
  - Creer user stories
  - Consulter backlog et avancement
- Developer:
  - Voir ses taches
  - Changer etat (TODO -> IN_PROGRESS -> DONE) uniquement si la tache est assignee
- Tester:
  - Voir ses taches
  - Changer etat (TODO -> IN_PROGRESS -> DONE) uniquement si la tache est assignee

### 2.3 Projets
- Creer un projet avec nom et description.
- Lister les projets.
- Selectionner un projet actif.
- Supprimer un projet (Scrum Master).

### 2.4 Sprints
- Creer un sprint pour le projet selectionne (nom, objectif, dates).
- Lister les sprints du projet selectionne.
- Selectionner un sprint actif.
- Supprimer un sprint (Scrum Master).

### 2.5 User stories
- Creer une user story pour le sprint selectionne (titre, description, priorite, story points).
- Lister les user stories du sprint selectionne.
- Supprimer une user story (Product Owner).

### 2.6 Taches
- Creer une tache liee a une user story du sprint selectionne (titre, description, assigne, etat initial TODO).
- Changer l'etat d'une tache selon le role et l'assignation.
- Supprimer une tache (Scrum Master).

### 2.7 Dashboard sprint (visible pour tous)
- Afficher le projet selectionne et le sprint actif.
- Afficher l'objectif du sprint.
- Afficher les dates du sprint.
- Afficher la progression (% de taches terminees).
- Afficher le comptage des taches par etat (TODO, IN_PROGRESS, DONE).

### 2.8 Tableau Scrum
- Colonnes: TODO, IN_PROGRESS, DONE.
- Taches affichees par colonne.
- Boutons d'etat visibles uniquement si permis par le role et l'assignation.

## 3. Perimetre technique
### 3.1 Frontend
- React (Vite).
- Appels API via /api (proxy Vite).
- Gestion d'etat locale avec hooks.

### 3.2 Backend
- API REST Node.js + Express.
- Connexion SQL Server avec retry.
- Initialisation automatique des tables et des contraintes.
- Mode demo en memoire si SQL Server indisponible.

### 3.3 Base de donnees (SQL Server)
Tables:
- users (id, name, email, password, role)
- projects (id, name, description, status, created_at, updated_at)
- sprints (id, project_id, name, goal, start_date, end_date, status, created_at, updated_at)
- user_stories (id, project_id, sprint_id, title, description, priority, story_points, status, created_at, updated_at)
- tasks (id, user_story_id, sprint_id, title, description, state, assignee, estimated_hours, created_at, updated_at)

Relations:
- projects -> sprints
- projects -> user_stories
- sprints -> user_stories
- user_stories -> tasks
- sprints -> tasks

## 4. Cas d'utilisation principaux
1. Scrum Master cree un projet et un sprint.
2. Product Owner cree des user stories.
3. Scrum Master cree des taches et assigne.
4. Developers/Testers changent l'etat des taches assignees.
5. Dashboard affiche l'avancement du sprint.

## 5. Interfaces et ecrans (V2)
- Ecran de login.
- Ecran principal avec:
  - Projet
  - Sprint + Dashboard sprint
  - User Story
  - Tableau Scrum

## 6. Contraintes et limites (V2)
- Pas de drag-and-drop (changement d'etat par boutons).
- Pas d'historique complet des actions.
- Mode demo actif si SQL Server non disponible.

## 7. Tests et verification
- Test des roles (permissions par role).
- Test CRUD projets/sprints/stories/taches.
- Test changements d'etat selon role/assignation.
- Test dashboard sprint.

## 8. Livrables V2
- Code source front et back.
- Base SQL Server initialisee automatiquement.
- Deploiement Docker via docker-compose.
- Cahier de charge (ce document).

## 9. Evolution possible (V3)
- Historique des actions (audit log).
- Drag-and-drop.
- Statistiques avancees par sprint.
- Authentification securisee (hash + JWT).
