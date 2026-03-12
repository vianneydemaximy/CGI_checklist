/**
 * pages/Dashboard.jsx
 * Lists all projects for the authenticated consultant/admin.
 * Allows creating new projects and navigating to checklists.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

/* ── Status badge mapping ──────────────────────────────────── */
const STATUS_BADGE = {
  draft:     'badge-gray',
  active:    'badge-green',
  completed: 'badge-blue',
  archived:  'badge-gray',
}

/* ── Completion progress bar ───────────────────────────────── */
function CompletionBar({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem', color: '#8888a0' }}>
        <span>{completed}/{total} tasks completed</span>
        <span style={{ fontFamily: "'Space Mono',monospace" }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-bar-fill ${pct === 100 ? 'green' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  /* New project form */
  const [showNew, setShowNew]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadProjects() }, [])

  /* ── Load projects with checklist stats ─────────────────── */
  async function loadProjects() {
    setLoading(true)
    try {
      const res = await api.get('/projects')

      // For each project, fetch checklist summary to compute completion
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

  /* ── Create project ─────────────────────────────────────── */
  async function createProject(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/projects', { name: newName, description: newDesc })
      setShowNew(false)
      setNewName('')
      setNewDesc('')
      loadProjects()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  /* ── Navigate to first checklist (or stay on dashboard) ─── */
  function openProject(project) {
    if (project.checklists?.length > 0) {
      navigate(`/projects/${project.id}/checklists/${project.checklists[0].id}`)
    } else {
      // No checklist yet — navigate to project and let user create one
      alert('This project has no checklist yet. Open the project and click "+ Add Checklist" or "AI Extract RFP".')
    }
  }

  /* ── Loading state ──────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', color: '#8888a0' }}>
        <span className="spinner" /> Loading projects…
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex-between mb-2">
        <div>
          <h1>Projects</h1>
          <p style={{ marginTop: 4 }}>
            {projects.length} mission{projects.length !== 1 ? 's' : ''} — click to open checklist
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + New Project
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── New project modal ─────────────────────────────── */}
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
                  placeholder="e.g. Société Générale — Data Platform Migration"
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  rows={3}
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="Brief mission description…"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><span className="spinner" /> Creating…</> : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#8888a0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>◫</div>
          <p>No projects yet. Click <strong>+ New Project</strong> to get started.</p>
        </div>
      ) : (
        /* ── Projects grid ───────────────────────────────── */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
        }}>
          {projects.map(project => (
            <div
              key={project.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => openProject(project)}
            >
              {/* Status + ID */}
              <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                <span className={`badge ${STATUS_BADGE[project.status] || 'badge-gray'}`}>
                  {project.status}
                </span>
                <span className="mono"># {String(project.id).padStart(4, '0')}</span>
              </div>

              {/* Name */}
              <h3 style={{ marginBottom: '0.3rem', color: '#e8e8ea' }}>{project.name}</h3>

              {/* Description (2 lines max) */}
              {project.description && (
                <p style={{
                  fontSize: '0.83rem', marginBottom: '1rem',
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {project.description}
                </p>
              )}

              {/* Progress */}
              <CompletionBar completed={project.completed} total={project.total} />

              {/* Meta info */}
              <div className="flex" style={{ gap: '1rem', marginTop: '0.75rem' }}>
                <span style={{ fontSize: '0.77rem', color: '#55555f' }}>
                  {project.checklist_count} checklist{project.checklist_count !== 1 ? 's' : ''}
                </span>
                {project.client_name && (
                  <span style={{ fontSize: '0.77rem', color: '#55555f' }}>
                    Ref: {project.client_name}
                  </span>
                )}
              </div>

              {/* Actions row */}
              <div style={{
                marginTop: '0.75rem', borderTop: '1px solid #2e2e33',
                paddingTop: '0.75rem', display: 'flex', gap: '0.5rem',
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