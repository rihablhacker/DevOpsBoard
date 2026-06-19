import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TASK_STATES = ['TODO', 'IN_PROGRESS', 'DONE']

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Erreur API')
  }

  if (response.status === 204) return null
  return response.json()
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [sprints, setSprints] = useState([])
  const [stories, setStories] = useState([])
  const [tasks, setTasks] = useState([])

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedSprintId, setSelectedSprintId] = useState('')
  const [error, setError] = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [projectForm, setProjectForm] = useState({ name: '', description: '' })
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', start_date: '', end_date: '' })
  const [storyForm, setStoryForm] = useState({
    title: '',
    description: '',
    story_points: 3,
    priority: 'MEDIUM',
  })
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignee: '',
    user_story_id: '',
  })

  async function login(event) {
    event.preventDefault()
    try {
      setError('')
      const user = await api('/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })
      setCurrentUser(user)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  function logout() {
    setCurrentUser(null)
    setLoginForm({ email: '', password: '' })
  }

  async function loadData() {
    try {
      setError('')
      const [usersData, projectsData, sprintsData, storiesData, tasksData] = await Promise.all([
        api('/users'),
        api('/projects'),
        api('/sprints'),
        api('/stories'),
        api('/tasks'),
      ])

      setUsers(usersData)
      setProjects(projectsData)
      setSprints(sprintsData)
      setStories(storiesData)
      setTasks(tasksData)

      if (projectsData.length > 0 && !selectedProjectId) {
        setSelectedProjectId(String(projectsData[0].id))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (currentUser) loadData()
  }, [currentUser])

  const projectSprints = useMemo(
    () => sprints.filter((sprint) => String(sprint.project_id) === selectedProjectId),
    [selectedProjectId, sprints],
  )

  const selectedProject = projects.find(
    (project) => String(project.id) === selectedProjectId,
  )
  const selectedSprint = sprints.find(
    (sprint) => String(sprint.id) === selectedSprintId,
  )

  useEffect(() => {
    if (projectSprints.length > 0) {
      setSelectedSprintId(String(projectSprints[0].id))
    } else {
      setSelectedSprintId('')
    }
  }, [selectedProjectId, projectSprints.length])

  const sprintStories = stories.filter((story) => String(story.sprint_id || '') === selectedSprintId)
  const sprintTasks = tasks.filter((task) => String(task.sprint_id || '') === selectedSprintId)

  const todoCount = sprintTasks.filter((task) => task.state === 'TODO').length
  const inProgressCount = sprintTasks.filter((task) => task.state === 'IN_PROGRESS').length
  const doneCount = sprintTasks.filter((task) => task.state === 'DONE').length

  const progress = sprintTasks.length === 0 ? 0 : Math.round((doneCount / sprintTasks.length) * 100)

  const canManageProject = currentUser?.role === 'SCRUM_MASTER'
  const canManageStory = currentUser?.role === 'PRODUCT_OWNER'
  const canAddTask = currentUser?.role === 'SCRUM_MASTER'
  const canDeleteTask = currentUser?.role === 'SCRUM_MASTER'

  function getAllowedNextStates(task, role) {
    if (!role) return []
    if (role === 'SCRUM_MASTER') {
      return TASK_STATES.filter((state) => state !== task.state)
    }
    if (role === 'DEVELOPER') {
      if (task.assignee && task.assignee !== currentUser?.name) return []
      if (task.state === 'TODO') return ['IN_PROGRESS']
      if (task.state === 'IN_PROGRESS') return ['DONE']
      return []
    }
    if (role === 'TESTER') {
      if (task.assignee && task.assignee !== currentUser?.name) return []
      if (task.state === 'TODO') return ['IN_PROGRESS']
      if (task.state === 'IN_PROGRESS') return ['DONE']
      return []
    }
    return []
  }

  async function createProject(event) {
    event.preventDefault()
    await api('/projects', { method: 'POST', body: JSON.stringify(projectForm) })
    setProjectForm({ name: '', description: '' })
    await loadData()
  }

  async function createSprint(event) {
    event.preventDefault()
    await api('/sprints', {
      method: 'POST',
      body: JSON.stringify({ ...sprintForm, project_id: Number(selectedProjectId) }),
    })
    setSprintForm({ name: '', goal: '', start_date: '', end_date: '' })
    await loadData()
  }

  async function createStory(event) {
    event.preventDefault()
    await api('/stories', {
      method: 'POST',
      body: JSON.stringify({
        ...storyForm,
        project_id: Number(selectedProjectId),
        sprint_id: Number(selectedSprintId),
      }),
    })
    setStoryForm({ title: '', description: '', story_points: 3, priority: 'MEDIUM' })
    await loadData()
  }

  async function createTask(event) {
    event.preventDefault()
    await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...taskForm,
        sprint_id: Number(selectedSprintId),
        user_story_id: Number(taskForm.user_story_id),
        state: 'TODO',
      }),
    })
    setTaskForm({ title: '', description: '', assignee: '', user_story_id: '' })
    await loadData()
  }

  async function removeEntity(path) {
    await api(path, { method: 'DELETE' })
    await loadData()
  }

  async function updateTaskState(taskId, state) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const allowed = getAllowedNextStates(task, currentUser?.role)
    if (!allowed.includes(state)) return
    await api(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...task, state }),
    })
    await loadData()
  }

  if (!currentUser) {
    return (
      <main className="layout">
        <section className="card login-card">
          <h1>DevOpsBoard</h1>
          <p>Connexion à la plateforme Agile Scrum</p>

          {error && <p className="error">{error}</p>}

          <form onSubmit={login}>
            <input
              type="email"
              required
              placeholder="Email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            />
            <input
              type="password"
              required
              placeholder="Mot de passe"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <button type="submit">Se connecter</button>
          </form>

          <p className="demo">
            scrum@demo.com / po@demo.com / dev@demo.com / test@demo.com
            <br />
            Mot de passe : 1234
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="layout">
      <header>
        <h1>DevOpsBoard - Agile Scrum</h1>
        <p>Gestion des projets, sprints, user stories et tableau de sprint.</p>

        <div className="user-box">
          <strong>{currentUser.name}</strong>
          <span>{currentUser.role}</span>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="cards">
        <article className="card">
          <h2>Projet</h2>

          {canManageProject && (
            <form onSubmit={createProject}>
              <input
                required
                placeholder="Nom du projet"
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              />
              <textarea
                placeholder="Description"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              />
              <button type="submit">Ajouter</button>
            </form>
          )}

          <ul className="list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  className={String(project.id) === selectedProjectId ? 'active' : ''}
                  onClick={() => setSelectedProjectId(String(project.id))}
                >
                  {project.name}
                </button>
                {canManageProject && (
                  <button className="danger" onClick={() => removeEntity(`/projects/${project.id}`)}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Sprint</h2>

          <div className="sprint-summary">
            <p>
              Projet: <strong>{selectedProject?.name || 'Aucun'}</strong>
            </p>
            <p>
              Sprint: <strong>{selectedSprint?.name || 'Aucun'}</strong>
            </p>
            <p>
              Objectif: <strong>{selectedSprint?.goal || 'Non defini'}</strong>
            </p>
            <p>
              Dates: <strong>{selectedSprint?.start_date || 'Non defini'}</strong> →{' '}
              <strong>{selectedSprint?.end_date || 'Non defini'}</strong>
            </p>
            <p>
              Progression: <strong>{progress}%</strong> ({doneCount}/{sprintTasks.length} terminees)
            </p>
            <p>
              TODO: <strong>{todoCount}</strong> | IN_PROGRESS: <strong>{inProgressCount}</strong> | DONE:{' '}
              <strong>{doneCount}</strong>
            </p>
          </div>

          {canManageProject && (
            <form onSubmit={createSprint}>
              <input
                required
                placeholder="Nom du sprint"
                value={sprintForm.name}
                onChange={(e) => setSprintForm({ ...sprintForm, name: e.target.value })}
              />
              <input
                placeholder="Objectif"
                value={sprintForm.goal}
                onChange={(e) => setSprintForm({ ...sprintForm, goal: e.target.value })}
              />
              <input
                type="date"
                value={sprintForm.start_date}
                onChange={(e) => setSprintForm({ ...sprintForm, start_date: e.target.value })}
              />
              <input
                type="date"
                value={sprintForm.end_date}
                onChange={(e) => setSprintForm({ ...sprintForm, end_date: e.target.value })}
              />
              <button type="submit" disabled={!selectedProjectId}>
                Ajouter
              </button>
            </form>
          )}

          <ul className="list">
            {projectSprints.map((sprint) => (
              <li key={sprint.id}>
                <button
                  className={String(sprint.id) === selectedSprintId ? 'active' : ''}
                  onClick={() => setSelectedSprintId(String(sprint.id))}
                >
                  {sprint.name}
                </button>
                {canManageProject && (
                  <button className="danger" onClick={() => removeEntity(`/sprints/${sprint.id}`)}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>User Story</h2>

          {canManageStory && (
            <form onSubmit={createStory}>
              <input
                required
                placeholder="Titre"
                value={storyForm.title}
                onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
              />
              <textarea
                placeholder="Description"
                value={storyForm.description}
                onChange={(e) => setStoryForm({ ...storyForm, description: e.target.value })}
              />
              <input
                type="number"
                min="1"
                value={storyForm.story_points}
                onChange={(e) =>
                  setStoryForm({ ...storyForm, story_points: Number(e.target.value) })
                }
              />
              <select
                value={storyForm.priority}
                onChange={(e) => setStoryForm({ ...storyForm, priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
              <button type="submit" disabled={!selectedSprintId}>
                Ajouter
              </button>
            </form>
          )}

          <ul className="list">
            {sprintStories.map((story) => (
              <li key={story.id}>
                <span>
                  {story.title} ({story.story_points} pts)
                </span>
                {canManageStory && (
                  <button className="danger" onClick={() => removeEntity(`/stories/${story.id}`)}>
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <h2>Tâches du sprint</h2>

        {canAddTask && (
          <form className="task-form" onSubmit={createTask}>
            <input
              required
              placeholder="Titre de la tâche"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            />

            <select
              required
              value={taskForm.assignee}
              onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
            >
              <option value="">Assigner à un membre</option>
              {users
                .filter((user) => user.role === 'DEVELOPER' || user.role === 'TESTER')
                .map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name} - {user.role}
                  </option>
                ))}
            </select>

            <textarea
              placeholder="Description"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />

            <select
              required
              value={taskForm.user_story_id}
              onChange={(e) => setTaskForm({ ...taskForm, user_story_id: e.target.value })}
            >
              <option value="">Choisir une user story</option>
              {sprintStories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.title}
                </option>
              ))}
            </select>

            <button type="submit" disabled={!selectedSprintId}>
              Ajouter
            </button>
          </form>
        )}

        <div className="progress">
          <strong>
            Avancement : {doneCount}/{sprintTasks.length} tâches terminées ({progress}%)
          </strong>
          <div className="bar">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="board">
          {TASK_STATES.map((state) => (
            <div key={state} className="column">
              <h3>{state}</h3>

              {sprintTasks
                .filter((task) => task.state === state)
                .map((task) => (
                  <article key={task.id} className="task">
                    <h4>{task.title}</h4>
                    <p>{task.description}</p>
                    <small>Assigné à : {task.assignee || 'Non assigné'}</small>

                    {getAllowedNextStates(task, currentUser?.role).length > 0 && (
                      <div className="actions">
                        {getAllowedNextStates(task, currentUser?.role).map((newState) => (
                          <button key={newState} onClick={() => updateTaskState(task.id, newState)}>
                            {newState}
                          </button>
                        ))}
                      </div>
                    )}

                    {canDeleteTask && (
                      <button className="danger" onClick={() => removeEntity(`/tasks/${task.id}`)}>
                        Supprimer
                      </button>
                    )}
                  </article>
                ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App