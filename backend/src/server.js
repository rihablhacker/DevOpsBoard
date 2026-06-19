import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { getPool, initializeDatabase, sql } from './db.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json())

let useDatabase = true

const memory = {
  users: [
    { id: 1, name: 'Scrum Master', email: 'scrum@demo.com', role: 'SCRUM_MASTER' },
    { id: 2, name: 'Product Owner', email: 'po@demo.com', role: 'PRODUCT_OWNER' },
    { id: 3, name: 'Dev', email: 'dev@demo.com', role: 'DEVELOPER' },
    { id: 4, name: 'Test', email: 'test@demo.com', role: 'TESTER' },
  ],
  projects: [
    { id: 1, name: 'Projet pilote', description: 'Exemple de projet pour demo.', status: 'ACTIVE' },
  ],
  sprints: [
    { id: 1, project_id: 1, name: 'Sprint 1', goal: 'Mettre en place la base', start_date: null, end_date: null, status: 'PLANNED' },
  ],
  stories: [
    { id: 1, project_id: 1, sprint_id: 1, title: 'Initialiser le tableau', description: 'Creer un premier flux de travail.', priority: 'MEDIUM', story_points: 3, status: 'TODO' },
  ],
  tasks: [
    { id: 1, user_story_id: 1, sprint_id: 1, title: 'Configurer le front', description: 'Page principale et styles de base.', state: 'IN_PROGRESS', assignee: 'Equipe UI', estimated_hours: 4 },
  ],
}

const memoryCounters = {
  users: 5,
  projects: 2,
  sprints: 2,
  stories: 2,
  tasks: 2,
}

function memoryList(resource) {
  return memory[resource].slice().sort((a, b) => b.id - a.id)
}

function memoryGet(resource, id) {
  return memory[resource].find((item) => item.id === id)
}

function memoryCreate(resource, payload) {
  const id = memoryCounters[resource]++
  const item = { id, ...payload }
  memory[resource].push(item)
  return item
}

function memoryUpdate(resource, id, payload) {
  const index = memory[resource].findIndex((item) => item.id === id)
  if (index === -1) return null
  memory[resource][index] = { ...memory[resource][index], ...payload }
  return memory[resource][index]
}

function memoryDelete(resource, id) {
  const index = memory[resource].findIndex((item) => item.id === id)
  if (index === -1) return false
  memory[resource].splice(index, 1)
  return true
}

// Simple in-memory test users for quick login (username/password = password)
const testUsers = [
  { id: 1, username: 'scrum', role: 'SCRUM_MASTER' },
  { id: 2, username: 'dev1', role: 'DEVELOPER' },
]

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'username/password required' })
  // quick test: accept password 'password' for demo users
  const user = testUsers.find((u) => u.username === username)
  if (!user || password !== 'password') return res.status(401).json({ message: 'Invalid credentials' })
  // return a simple token and user (no JWT for quick demo)
  return res.json({ token: 'dev-token', user })
})

// Frontend expects POST /api/login with { email, password }
const demoEmailUsers = {
  'scrum@demo.com': { id: 1, name: 'Scrum Master', email: 'scrum@demo.com', role: 'SCRUM_MASTER' },
  'po@demo.com': { id: 2, name: 'Product Owner', email: 'po@demo.com', role: 'PRODUCT_OWNER' },
  'dev@demo.com': { id: 3, name: 'Dev', email: 'dev@demo.com', role: 'DEVELOPER' },
  'test@demo.com': { id: 4, name: 'Test', email: 'test@demo.com', role: 'TESTER' },
}

function handleError(response, error) {
  console.error(error)
  response.status(500).json({ message: 'Erreur serveur', details: error.message })
}

async function queryMany(query, parameters = []) {
  const pool = await getPool()
  const request = pool.request()

  parameters.forEach(({ name, type, value }) => {
    request.input(name, type, value)
  })

  const result = await request.query(query)
  return result.recordset
}

async function queryOne(query, parameters = []) {
  const rows = await queryMany(query, parameters)
  return rows[0]
}

/* ================= LOGIN + USERS ================= */

app.post('/api/login', async (request, response) => {
  try {
    const { email, password } = request.body || {}
    if (!email || !password) return response.status(400).json({ message: 'email/password required' })

    if (!useDatabase) {
      const user = demoEmailUsers[email]
      if (!user || password !== '1234') {
        return response.status(401).json({ message: 'Email ou mot de passe incorrect' })
      }
      return response.json(user)
    }

    const user = await queryOne(
      'SELECT id, name, email, role FROM users WHERE email = @email AND password = @password',
      [
        { name: 'email', type: sql.NVarChar(150), value: email },
        { name: 'password', type: sql.NVarChar(100), value: password },
      ],
    )

    if (!user) {
      return response.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }

    response.json(user)
  } catch (error) {
    handleError(response, error)
  }
})

app.get('/api/users', async (_request, response) => {
  try {
    if (!useDatabase) return response.json(memoryList('users'))
    const users = await queryMany('SELECT id, name, email, role FROM users ORDER BY id ASC')
    response.json(users)
  } catch (error) {
    handleError(response, error)
  }
})

/* ================= PROJECTS ================= */

app.get('/api/projects', async (_request, response) => {
  try {
    if (!useDatabase) return response.json(memoryList('projects'))
    const rows = await queryMany('SELECT * FROM projects ORDER BY id DESC')
    response.json(rows)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/projects', async (request, response) => {
  try {
    const { name, description = '', status = 'ACTIVE' } = request.body

    if (!useDatabase) {
      const row = memoryCreate('projects', { name, description, status })
      return response.status(201).json(row)
    }

    const row = await queryOne(
      `INSERT INTO projects (name, description, status)
       OUTPUT inserted.*
       VALUES (@name, @description, @status)`,
      [
        { name: 'name', type: sql.NVarChar(150), value: name },
        { name: 'description', type: sql.NVarChar(sql.MAX), value: description },
        { name: 'status', type: sql.NVarChar(30), value: status },
      ],
    )

    response.status(201).json(row)
  } catch (error) {
    handleError(response, error)
  }
})

app.delete('/api/projects/:id', async (request, response) => {
  try {
    if (!useDatabase) {
      const deleted = memoryDelete('projects', Number(request.params.id))
      if (!deleted) {
        return response.status(404).json({ message: 'Projet introuvable' })
      }
      return response.status(204).send()
    }
    const rows = await queryMany('DELETE FROM projects OUTPUT deleted.* WHERE id = @id', [
      { name: 'id', type: sql.Int, value: Number(request.params.id) },
    ])

    if (rows.length === 0) {
      return response.status(404).json({ message: 'Projet introuvable' })
    }

    response.status(204).send()
  } catch (error) {
    handleError(response, error)
  }
})

/* ================= SPRINTS ================= */

app.get('/api/sprints', async (_request, response) => {
  try {
    if (!useDatabase) return response.json(memoryList('sprints'))
    const rows = await queryMany('SELECT * FROM sprints ORDER BY id DESC')
    response.json(rows)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/sprints', async (request, response) => {
  try {
    const {
      project_id,
      name,
      goal = '',
      start_date = null,
      end_date = null,
      status = 'PLANNED',
    } = request.body

    if (!useDatabase) {
      const row = memoryCreate('sprints', {
        project_id: Number(project_id),
        name,
        goal,
        start_date: start_date || null,
        end_date: end_date || null,
        status,
      })
      return response.status(201).json(row)
    }

    const row = await queryOne(
      `INSERT INTO sprints (project_id, name, goal, start_date, end_date, status)
       OUTPUT inserted.*
       VALUES (@project_id, @name, @goal, @start_date, @end_date, @status)`,
      [
        { name: 'project_id', type: sql.Int, value: Number(project_id) },
        { name: 'name', type: sql.NVarChar(150), value: name },
        { name: 'goal', type: sql.NVarChar(sql.MAX), value: goal },
        { name: 'start_date', type: sql.Date, value: start_date || null },
        { name: 'end_date', type: sql.Date, value: end_date || null },
        { name: 'status', type: sql.NVarChar(30), value: status },
      ],
    )

    response.status(201).json(row)
  } catch (error) {
    handleError(response, error)
  }
})

app.delete('/api/sprints/:id', async (request, response) => {
  try {
    if (!useDatabase) {
      const deleted = memoryDelete('sprints', Number(request.params.id))
      if (!deleted) {
        return response.status(404).json({ message: 'Sprint introuvable' })
      }
      return response.status(204).send()
    }
    const rows = await queryMany('DELETE FROM sprints OUTPUT deleted.* WHERE id = @id', [
      { name: 'id', type: sql.Int, value: Number(request.params.id) },
    ])

    if (rows.length === 0) {
      return response.status(404).json({ message: 'Sprint introuvable' })
    }

    response.status(204).send()
  } catch (error) {
    handleError(response, error)
  }
})

/* ================= USER STORIES ================= */

app.get('/api/stories', async (_request, response) => {
  try {
    if (!useDatabase) return response.json(memoryList('stories'))
    const rows = await queryMany('SELECT * FROM user_stories ORDER BY id DESC')
    response.json(rows)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/stories', async (request, response) => {
  try {
    const {
      project_id,
      sprint_id = null,
      title,
      description = '',
      priority = 'MEDIUM',
      story_points = 3,
      status = 'TODO',
    } = request.body

    if (!useDatabase) {
      const row = memoryCreate('stories', {
        project_id: Number(project_id),
        sprint_id: sprint_id ? Number(sprint_id) : null,
        title,
        description,
        priority,
        story_points: Number(story_points),
        status,
      })
      return response.status(201).json(row)
    }

    const row = await queryOne(
      `INSERT INTO user_stories
       (project_id, sprint_id, title, description, priority, story_points, status)
       OUTPUT inserted.*
       VALUES (@project_id, @sprint_id, @title, @description, @priority, @story_points, @status)`,
      [
        { name: 'project_id', type: sql.Int, value: Number(project_id) },
        { name: 'sprint_id', type: sql.Int, value: sprint_id ? Number(sprint_id) : null },
        { name: 'title', type: sql.NVarChar(200), value: title },
        { name: 'description', type: sql.NVarChar(sql.MAX), value: description },
        { name: 'priority', type: sql.NVarChar(20), value: priority },
        { name: 'story_points', type: sql.Int, value: Number(story_points) },
        { name: 'status', type: sql.NVarChar(30), value: status },
      ],
    )

    response.status(201).json(row)
  } catch (error) {
    handleError(response, error)
  }
})

app.delete('/api/stories/:id', async (request, response) => {
  try {
    if (!useDatabase) {
      const deleted = memoryDelete('stories', Number(request.params.id))
      if (!deleted) {
        return response.status(404).json({ message: 'User story introuvable' })
      }
      return response.status(204).send()
    }
    const rows = await queryMany('DELETE FROM user_stories OUTPUT deleted.* WHERE id = @id', [
      { name: 'id', type: sql.Int, value: Number(request.params.id) },
    ])

    if (rows.length === 0) {
      return response.status(404).json({ message: 'User story introuvable' })
    }

    response.status(204).send()
  } catch (error) {
    handleError(response, error)
  }
})

/* ================= TASKS ================= */

app.get('/api/tasks', async (_request, response) => {
  try {
    if (!useDatabase) return response.json(memoryList('tasks'))
    const rows = await queryMany('SELECT * FROM tasks ORDER BY id DESC')
    response.json(rows)
  } catch (error) {
    handleError(response, error)
  }
})

app.post('/api/tasks', async (request, response) => {
  try {
    const {
      user_story_id,
      sprint_id = null,
      title,
      description = '',
      state = 'TODO',
      assignee = '',
      estimated_hours = null,
    } = request.body

    if (!useDatabase) {
      const row = memoryCreate('tasks', {
        user_story_id: Number(user_story_id),
        sprint_id: sprint_id ? Number(sprint_id) : null,
        title,
        description,
        state,
        assignee,
        estimated_hours: estimated_hours ? Number(estimated_hours) : null,
      })
      return response.status(201).json(row)
    }

    const row = await queryOne(
      `INSERT INTO tasks
       (user_story_id, sprint_id, title, description, state, assignee, estimated_hours)
       OUTPUT inserted.*
       VALUES (@user_story_id, @sprint_id, @title, @description, @state, @assignee, @estimated_hours)`,
      [
        { name: 'user_story_id', type: sql.Int, value: Number(user_story_id) },
        { name: 'sprint_id', type: sql.Int, value: sprint_id ? Number(sprint_id) : null },
        { name: 'title', type: sql.NVarChar(200), value: title },
        { name: 'description', type: sql.NVarChar(sql.MAX), value: description },
        { name: 'state', type: sql.NVarChar(20), value: state },
        { name: 'assignee', type: sql.NVarChar(120), value: assignee },
        {
          name: 'estimated_hours',
          type: sql.Int,
          value: estimated_hours ? Number(estimated_hours) : null,
        },
      ],
    )

    response.status(201).json(row)
  } catch (error) {
    handleError(response, error)
  }
})

app.put('/api/tasks/:id', async (request, response) => {
  try {
    const {
      user_story_id,
      sprint_id = null,
      title,
      description = '',
      state = 'TODO',
      assignee = '',
      estimated_hours = null,
    } = request.body

    if (!useDatabase) {
      const row = memoryUpdate('tasks', Number(request.params.id), {
        user_story_id: Number(user_story_id),
        sprint_id: sprint_id ? Number(sprint_id) : null,
        title,
        description,
        state,
        assignee,
        estimated_hours: estimated_hours ? Number(estimated_hours) : null,
      })
      if (!row) {
        return response.status(404).json({ message: 'Tâche introuvable' })
      }
      return response.json(row)
    }

    const row = await queryOne(
      `UPDATE tasks
       SET user_story_id = @user_story_id,
           sprint_id = @sprint_id,
           title = @title,
           description = @description,
           state = @state,
           assignee = @assignee,
           estimated_hours = @estimated_hours,
           updated_at = SYSUTCDATETIME()
       OUTPUT inserted.*
       WHERE id = @id`,
      [
        { name: 'id', type: sql.Int, value: Number(request.params.id) },
        { name: 'user_story_id', type: sql.Int, value: Number(user_story_id) },
        { name: 'sprint_id', type: sql.Int, value: sprint_id ? Number(sprint_id) : null },
        { name: 'title', type: sql.NVarChar(200), value: title },
        { name: 'description', type: sql.NVarChar(sql.MAX), value: description },
        { name: 'state', type: sql.NVarChar(20), value: state },
        { name: 'assignee', type: sql.NVarChar(120), value: assignee },
        {
          name: 'estimated_hours',
          type: sql.Int,
          value: estimated_hours ? Number(estimated_hours) : null,
        },
      ],
    )

    if (!row) {
      return response.status(404).json({ message: 'Tâche introuvable' })
    }

    response.json(row)
  } catch (error) {
    handleError(response, error)
  }
})

app.delete('/api/tasks/:id', async (request, response) => {
  try {
    if (!useDatabase) {
      const deleted = memoryDelete('tasks', Number(request.params.id))
      if (!deleted) {
        return response.status(404).json({ message: 'Tâche introuvable' })
      }
      return response.status(204).send()
    }
    const rows = await queryMany('DELETE FROM tasks OUTPUT deleted.* WHERE id = @id', [
      { name: 'id', type: sql.Int, value: Number(request.params.id) },
    ])

    if (rows.length === 0) {
      return response.status(404).json({ message: 'Tâche introuvable' })
    }

    response.status(204).send()
  } catch (error) {
    handleError(response, error)
  }
})

/* ================= HEALTH ================= */

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

// Try to initialize DB but do not exit on failure (keep server available for demo endpoints)
;(async () => {
  try {
    await initializeDatabase()
    useDatabase = true
    console.log('Database initialized')
  } catch (error) {
    useDatabase = false
    console.warn('DB init failed, continuing in demo mode:', error && error.message)
  }

  app.listen(port, () => {
    console.log(`DevOpsBoard API running on http://localhost:${port}`)
  })
})()