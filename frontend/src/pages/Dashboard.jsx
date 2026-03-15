/**
 * pages/Dashboard.jsx — V2
 * - Sélection d'un template checklist à la création de projet
 * - Création automatique de la checklist + navigation directe
 * - Plus d'alerte "no checklist" — le projet s'ouvre toujours
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const STATUS_BADGE = {
  draft:     'badge-gray',
  active:    'badge-green',
  completed: 'badge-blue',
  archived:  'badge-gray',
}

function CompletionBar({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:'0.75rem', color:'#8888a0' }}>
        <span>{completed}/{total} tasks</span>
        <span style={{ fontFamily:"'Space Mono',monospace" }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-bar-fill ${pct === 100 ? 'green' : ''}`} style={{ width:`${pct}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [projects, setProjects]   = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  // Formulaire nouveau projet
  const [showNew, setShowNew]               = useState(false)
  const [newName, setNewName]               = useState('')
  const [newDesc, setNewDesc]               = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [creating, setCreating]             = useState(false)

  useEffect(() => {
    loadProjects()
    // Charger les templates pour le sélecteur à la création
    api.get('/templates')
      .then(r => setTemplates(r.data))
      .catch(() => {})
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const res = await api.get('/projects')
      const withStats = await Promise.all(res.data.map(async project => {
        try {
          const cr = await api.get(`/projects/${project.id}/checklists`)
          const totals = cr.data.reduce(
            (acc, c) => ({
              total:     acc.total     + (c.total_tasks     || 0),
              completed: acc.completed + (c.completed_tasks || 0),
            }),
            { total: 0, completed: 0 }
          )
          return { ...project, ...totals, checklist_count: cr.data.length, checklists: cr.data }
        } catch {
          return { ...project, total: 0, completed: 0, checklist_count: 0, checklists: [] }
        }
      }))
      setProjects(withStats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Création du projet + checklist associée en une seule action.
   * Si un template est sélectionné, les items sont clonés automatiquement.
   * Navigation directe vers la checklist créée.
   */
  async function createProject(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      // 1. Créer le projet
      const projRes = await api.post('/projects', { name: newName, description: newDesc })
      const projectId = projRes.data.id

      // 2. Créer la checklist (avec ou sans template)
      const clRes = await api.post(`/projects/${projectId}/checklists`, {
        title:       newName,
        source:      selectedTemplate ? 'template' : 'manual',
        template_id: selectedTemplate ? parseInt(selectedTemplate, 10) : undefined,
      })
      const checklistId = clRes.data.id

      // 3. Réinitialiser et naviguer directement
      setShowNew(false)
      setNewName('')
      setNewDesc('')
      setSelectedTemplate('')
      navigate(`/projects/${projectId}/checklists/${checklistId}`)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  /**
   * Ouvre la première checklist d'un projet.
   * Propose la création si aucune checklist n'existe encore.
   */
  async function openProject(project) {
    if (project.checklists?.length > 0) {
      navigate(`/projects/${project.id}/checklists/${project.checklists[0].id}`)
    } else {
      // Créer une checklist vide à la volée
      try {
        const clRes = await api.post(`/projects/${project.id}/checklists`, {
          title:  project.name,
          source: 'manual',
        })
        navigate(`/projects/${project.id}/checklists/${clRes.data.id}`)
      } catch (err) {
        setError('Could not open project: ' + err.message)
      }
    }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'2rem', color:'#8888a0' }}>
      <span className="spinner" /> Loading projects…
    </div>
  )

  return (
    <div>
      {/* En-tête */}
      <div className="flex-between mb-2">
        <div>
          <h1>Projects</h1>
          <p style={{ marginTop:4 }}>
            {projects.length} mission{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + New Project
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Modal nouveau projet ──────────────────────────── */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Project</h2>
              <button className="btn-icon" onClick={() => setShowNew(false)}>✕</button>
            </div>

            <form onSubmit={createProject}>
              <div className="form-group">
                <label>Project name *</label>
                <input
                  autoFocus required
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Société Générale — Data Platform"
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  rows={3} value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Brief mission description…"
                  style={{ resize:'vertical' }}
                />
              </div>

              {/* Sélecteur de template */}
              <div className="form-group">
                <label>Checklist template</label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                >
                  <option value="">— Empty checklist —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.is_global ? '🌐 ' : '👤 '}{t.name}
                      {t.item_count ? ` (${t.item_count} items)` : ''}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <p style={{ fontSize:'0.78rem', color:'#8888a0', marginTop:4 }}>
                    Template items will be added to the checklist. You can edit them after creation.
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating
                    ? <><span className="spinner" /> Creating…</>
                    : 'Create & Open →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── État vide ─────────────────────────────────────── */}
      {projects.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'3rem', color:'#8888a0' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>◫</div>
          <p>No projects yet. Click <strong>+ New Project</strong> to get started.</p>
        </div>
      ) : (
        /* ── Grille de projets ────────────────────────────── */
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',
          gap:'1rem',
        }}>
          {projects.map(project => (
            <div
              key={project.id}
              className="card"
              style={{ cursor:'pointer' }}
              onClick={() => openProject(project)}
            >
              {/* Statut + ID */}
              <div className="flex-between" style={{ marginBottom:'0.75rem' }}>
                <span className={`badge ${STATUS_BADGE[project.status] || 'badge-gray'}`}>
                  {project.status}
                </span>
                <span className="mono"># {String(project.id).padStart(4, '0')}</span>
              </div>

              <h3 style={{ marginBottom:'0.3rem', color:'#e8e8ea' }}>{project.name}</h3>

              {project.description && (
                <p style={{
                  fontSize:'0.83rem', marginBottom:'1rem',
                  overflow:'hidden', display:'-webkit-box',
                  WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                }}>
                  {project.description}
                </p>
              )}

              <CompletionBar completed={project.completed} total={project.total} />

              <div className="flex" style={{ gap:'1rem', marginTop:'0.75rem' }}>
                <span style={{ fontSize:'0.77rem', color:'#55555f' }}>
                  {project.checklist_count} checklist{project.checklist_count !== 1 ? 's' : ''}
                </span>
                {project.client_name && (
                  <span style={{ fontSize:'0.77rem', color:'#55555f' }}>
                    Ref: {project.client_name}
                  </span>
                )}
              </div>

              <div style={{
                marginTop:'0.75rem', borderTop:'1px solid #2e2e33',
                paddingTop:'0.75rem', display:'flex', gap:'0.5rem',
              }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); navigate(`/projects/${project.id}/history`) }}
                >
                  History
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); openProject(project) }}
                >
                  Open →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}