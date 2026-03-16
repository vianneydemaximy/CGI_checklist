/**
 * pages/Dashboard.jsx — V3
 * - Sélecteur de langue à la création de projet
 * - Filtre les templates par langue
 * - Auto-navigation vers la checklist créée
 * - ORDER BY checklists (fix tâches perdues)
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
const LANG_LABELS = { en: '🇬🇧 English', fr: '🇫🇷 Français' }

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

  const [projects,  setProjects]  = useState([])
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  /* Form nouveau projet */
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

  /* Filtrer les templates selon la langue sélectionnée */
  const filteredTemplates = templates.filter(t => t.language === newLang || !t.language)

  /* Réinitialiser le template sélectionné quand la langue change */
  function handleLangChange(lang) {
    setNewLang(lang)
    setSelectedTemplate('')
  }

  async function createProject(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true); setError('')
    try {
      /* 1. Créer le projet avec la langue */
      const projRes = await api.post('/projects', {
        name: newName, description: newDesc, language: newLang,
      })
      const projectId = projRes.data.id

      /* 2. Créer la checklist (avec template si sélectionné) */
      const clRes = await api.post(`/projects/${projectId}/checklists`, {
        title:       newName,
        source:      selectedTemplate ? 'template' : 'manual',
        template_id: selectedTemplate ? parseInt(selectedTemplate, 10) : undefined,
      })

      /* 3. Navigation directe */
      setShowNew(false)
      setNewName(''); setNewDesc(''); setNewLang('en'); setSelectedTemplate('')
      navigate(`/projects/${projectId}/checklists/${clRes.data.id}`)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  async function openProject(project) {
    if (project.checklists?.length > 0) {
      navigate(`/projects/${project.id}/checklists/${project.checklists[0].id}`)
    } else {
      /* Créer une checklist vide à la volée si le projet n'en a pas */
      try {
        const clRes = await api.post(`/projects/${project.id}/checklists`, {
          title: project.name, source: 'manual',
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
          <p style={{ marginTop:4 }}>{projects.length} mission{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Project</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

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
                  placeholder="Brief mission description…" style={{ resize:'vertical' }} />
              </div>

              {/* Sélecteur de langue */}
              <div className="form-group">
                <label>Language</label>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {Object.entries(LANG_LABELS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => handleLangChange(k)} style={{
                      flex:1, padding:'0.55rem', borderRadius:6, cursor:'pointer',
                      border:     newLang === k ? '1px solid #e8652a' : '1px solid #2e2e33',
                      background: newLang === k ? 'rgba(232,101,42,0.1)' : '#18181b',
                      color:      newLang === k ? '#e8652a' : '#8888a0',
                      fontSize:'0.88rem', fontWeight: newLang === k ? 500 : 400,
                    }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélecteur de template checklist (filtré par langue) */}
              <div className="form-group">
                <label>Checklist template</label>
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                  <option value="">— Empty checklist —</option>
                  {filteredTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.is_global ? '🌐 ' : '👤 '}{t.name}
                      {t.item_count ? ` (${t.item_count} items)` : ''}
                    </option>
                  ))}
                </select>
                {filteredTemplates.length === 0 && (
                  <p style={{ fontSize:'0.78rem', color:'#8888a0', marginTop:4 }}>
                    No templates available in {LANG_LABELS[newLang]}. Run migration_v3.sql or create templates in the Templates page.
                  </p>
                )}
                {selectedTemplate && (
                  <p style={{ fontSize:'0.78rem', color:'#8888a0', marginTop:4 }}>
                    Template items will be pre-filled. You can edit them after creation.
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><span className="spinner" /> Creating…</> : 'Create & Open →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── État vide ── */}
      {projects.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'3rem', color:'#8888a0' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>◫</div>
          <p>No projects yet. Click <strong>+ New Project</strong> to get started.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1rem' }}>
          {projects.map(project => (
            <div key={project.id} className="card" style={{ cursor:'pointer' }}
              onClick={() => openProject(project)}>

              <div className="flex-between" style={{ marginBottom:'0.75rem' }}>
                <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                  <span className={`badge ${STATUS_BADGE[project.status] || 'badge-gray'}`}>
                    {project.status}
                  </span>
                  {project.language && (
                    <span style={{ fontSize:'0.72rem' }}>
                      {project.language === 'fr' ? '🇫🇷' : '🇬🇧'}
                    </span>
                  )}
                </div>
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
                  <span style={{ fontSize:'0.77rem', color:'#55555f' }}>Ref: {project.client_name}</span>
                )}
              </div>

              <div style={{ marginTop:'0.75rem', borderTop:'1px solid #2e2e33', paddingTop:'0.75rem', display:'flex', gap:'0.5rem' }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); navigate(`/projects/${project.id}/history`) }}>
                  History
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); openProject(project) }}>
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