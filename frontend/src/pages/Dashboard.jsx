/**
 * pages/Dashboard.jsx — V3
 * - Thème clair
 * - Archive / suppression de projets (avec confirmation)
 * - Filtres : tous / actifs / archivés
 * - Projets archivés dans une section séparée plus bas
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const LANG_LABELS = { en: '🇬🇧 English', fr: '🇫🇷 Français' }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3,
        fontSize: '0.73rem', color: '#6B7280' }}>
        <span>{completed}/{total} tasks</span>
        <span style={{ fontFamily: "'Space Mono',monospace" }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-bar-fill ${pct === 100 ? 'green' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ProjectCard({ project, onOpen, onArchive, onUnarchive, onDelete }) {
  const isArchived = project.status === 'archived'
  return (
    <div className="card"
      style={{ cursor: 'pointer', opacity: isArchived ? 0.75 : 1 }}
      onClick={() => onOpen(project)}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${STATUS_BADGE[project.status] || 'badge-gray'}`}>
            {project.status}
          </span>
          {project.language && (
            <span style={{ fontSize: '0.75rem' }}>
              {project.language === 'fr' ? '🇫🇷' : '🇬🇧'}
            </span>
          )}
        </div>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', color: '#9CA3AF' }}>
          #{String(project.id).padStart(4, '0')}
        </span>
      </div>

      <h3 style={{ marginBottom: '0.3rem' }}>{project.name}</h3>

      {project.description && (
        <p style={{
          fontSize: '0.83rem', marginBottom: '1rem',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {project.description}
        </p>
      )}

      <CompletionBar completed={project.completed} total={project.total} />

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
          {project.checklist_count} checklist{project.checklist_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions */}
      <div style={{
        marginTop: '0.75rem', borderTop: '1px solid #E2E4EA',
        paddingTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
      }}>
        <button className="btn btn-ghost btn-sm"
          onClick={e => { e.stopPropagation(); onOpen(project) }}>
          Open →
        </button>
        {isArchived ? (
          <button className="btn btn-ghost btn-sm"
            onClick={e => { e.stopPropagation(); onUnarchive(project.id) }}
            title="Restore project">
            ↩ Restore
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm"
            onClick={e => { e.stopPropagation(); onArchive(project.id) }}
            title="Archive project"
            style={{ color: '#D97706' }}>
            ◎ Archive
          </button>
        )}
        <button className="btn btn-danger btn-sm"
          onClick={e => { e.stopPropagation(); onDelete(project.id, project.name) }}>
          🗑 Delete
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [projects,   setProjects]   = useState([])
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [filter,     setFilter]     = useState('active')  // 'active' | 'archived' | 'all'

  /* Formulaire nouveau projet */
  const [showNew,          setShowNew]          = useState(false)
  const [newName,          setNewName]          = useState('')
  const [newDesc,          setNewDesc]          = useState('')
  const [newLang,          setNewLang]          = useState('en')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [creating,         setCreating]         = useState(false)

  useEffect(() => {
    loadProjects()
    api.get('/templates').then(r => setTemplates(r.data)).catch(() => {})
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const res = await api.get('/projects')
      const withStats = await Promise.all(res.data.map(async p => {
        try {
          const cr = await api.get(`/projects/${p.id}/checklists`)
          const totals = cr.data.reduce(
            (acc, c) => ({
              total:     acc.total     + (c.total_tasks     || 0),
              completed: acc.completed + (c.completed_tasks || 0),
            }),
            { total: 0, completed: 0 }
          )
          return { ...p, ...totals, checklist_count: cr.data.length, checklists: cr.data }
        } catch {
          return { ...p, total: 0, completed: 0, checklist_count: 0, checklists: [] }
        }
      }))
      setProjects(withStats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /* ── Actions projet ─────────────────────────────────────────── */
  async function archiveProject(id) {
    if (!window.confirm('Archive this project? It will be moved to the archived section.')) return
    try {
      await api.put(`/projects/${id}`, { status: 'archived' })
      loadProjects()
    } catch (err) { setError(err.message) }
  }

  async function unarchiveProject(id) {
    if (!window.confirm('Restore this project to active?')) return
    try {
      await api.put(`/projects/${id}`, { status: 'active' })
      loadProjects()
    } catch (err) { setError(err.message) }
  }

  async function deleteProject(id, name) {
    if (!window.confirm(`Permanently delete "${name}"?\n\nThis will also delete all checklists, tasks and documents. This cannot be undone.`)) return
    try {
      await api.delete(`/projects/${id}`)
      loadProjects()
    } catch (err) { setError(err.message) }
  }

  async function openProject(project) {
    if (project.checklists?.length > 0) {
      navigate(`/projects/${project.id}/checklists/${project.checklists[0].id}`)
    } else {
      try {
        const cl = await api.post(`/projects/${project.id}/checklists`, { title: project.name, source: 'manual' })
        navigate(`/projects/${project.id}/checklists/${cl.data.id}`)
      } catch (err) { setError(err.message) }
    }
  }

  /* ── Création ───────────────────────────────────────────────── */
  const filteredTemplates = templates.filter(t => t.language === newLang || !t.language)

  async function createProject(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true); setError('')
    try {
      const pRes = await api.post('/projects', { name: newName, description: newDesc, language: newLang })
      const projectId = pRes.data.id
      const clRes = await api.post(`/projects/${projectId}/checklists`, {
        title: newName,
        source: selectedTemplate ? 'template' : 'manual',
        template_id: selectedTemplate ? parseInt(selectedTemplate, 10) : undefined,
      })
      setShowNew(false)
      setNewName(''); setNewDesc(''); setNewLang('en'); setSelectedTemplate('')
      navigate(`/projects/${projectId}/checklists/${clRes.data.id}`)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  /* ── Tri / filtrage ─────────────────────────────────────────── */
  const activeProjects   = projects.filter(p => p.status !== 'archived')
  const archivedProjects = projects.filter(p => p.status === 'archived')
  const showActive   = filter === 'all' || filter === 'active'
  const showArchived = filter === 'all' || filter === 'archived'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', color: '#6B7280' }}>
      <span className="spinner" /> Loading projects…
    </div>
  )

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
    gap: '1rem',
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex-between mb-2">
        <div>
          <h1>Projects</h1>
          <p style={{ marginTop: 4 }}>
            {activeProjects.length} active · {archivedProjects.length} archived
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          + New Project
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'active',   label: 'Active' },
          { id: 'all',      label: 'All' },
          { id: 'archived', label: 'Archived' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="btn btn-ghost btn-sm"
            style={{
              color:      filter === f.id ? '#D6062B' : undefined,
              background: filter === f.id ? 'rgba(214,6,43,0.07)' : undefined,
              border:     filter === f.id ? '1px solid rgba(214,6,43,0.3)' : undefined,
              fontWeight: filter === f.id ? 600 : 400,
            }}>
            {f.label}
            <span style={{
              marginLeft: '0.3rem', fontSize: '0.7rem', padding: '0.05rem 0.35rem',
              background: '#F3F4F6', borderRadius: 999, color: '#6B7280',
            }}>
              {f.id === 'active' ? activeProjects.length
               : f.id === 'archived' ? archivedProjects.length
               : projects.length}
            </span>
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Section Active ── */}
      {showActive && (
        <>
          {activeProjects.length === 0 ? (
            filter !== 'all' && (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280' }}>
                <p>No active projects. Click <strong>+ New Project</strong> to create one.</p>
              </div>
            )
          ) : (
            <div style={gridStyle}>
              {activeProjects.map(p => (
                <ProjectCard key={p.id} project={p}
                  onOpen={openProject}
                  onArchive={archiveProject}
                  onUnarchive={unarchiveProject}
                  onDelete={deleteProject} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Section Archivés ── */}
      {showArchived && archivedProjects.length > 0 && (
        <div style={{ marginTop: showActive && activeProjects.length > 0 ? '2.5rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1, height: 1, background: '#E2E4EA' }} />
            <span style={{
              fontSize: '0.75rem', color: '#9CA3AF',
              fontFamily: "'Space Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Archived ({archivedProjects.length})
            </span>
            <div style={{ flex: 1, height: 1, background: '#E2E4EA' }} />
          </div>
          <div style={gridStyle}>
            {archivedProjects.map(p => (
              <ProjectCard key={p.id} project={p}
                onOpen={openProject}
                onArchive={archiveProject}
                onUnarchive={unarchiveProject}
                onDelete={deleteProject} />
            ))}
          </div>
        </div>
      )}

      {/* État vide global */}
      {projects.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>◫</div>
          <p>No projects yet. Click <strong>+ New Project</strong> to get started.</p>
        </div>
      )}

      {/* ── Modal nouveau projet ── */}
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
                <input autoFocus required value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Société Générale — Data Platform" />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea rows={3} value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Brief mission description…"
                  style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label>Language</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {Object.entries(LANG_LABELS).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => { setNewLang(k); setSelectedTemplate('') }}
                      style={{
                        flex: 1, padding: '0.55rem', borderRadius: 6, cursor: 'pointer',
                        border:     newLang === k ? '1px solid #D6062B' : '1px solid #E2E4EA',
                        background: newLang === k ? 'rgba(214,6,43,0.07)' : '#fff',
                        color:      newLang === k ? '#D6062B' : '#6B7280',
                        fontSize: '0.88rem', fontWeight: newLang === k ? 600 : 400,
                        transition: '0.12s',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Checklist template</label>
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                  <option value="">— Empty checklist —</option>
                  {filteredTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.is_global ? '🌐 ' : '👤 '}{t.name}{t.item_count ? ` (${t.item_count})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><span className="spinner" /> Creating…</> : 'Create & Open →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}