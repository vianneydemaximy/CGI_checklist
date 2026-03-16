/**
 * pages/ChecklistView.jsx — V2
 * Passe consultantName au EmailModal pour les placeholders.
 */
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import TaskItem   from '../components/TaskItem'
import EmailModal from '../components/EmailModal'

function ScoreCard({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="card" style={{ padding:'1rem', textAlign:'center', minWidth:130 }}>
      <div style={{ fontSize:'1.8rem', fontWeight:700, color, fontFamily:"'Space Mono',monospace" }}>{value}</div>
      <div style={{ fontSize:'0.75rem', color:'#55555f', marginBottom:'0.5rem' }}>{label}</div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
      <div style={{ fontSize:'0.7rem', color:'#55555f', marginTop:'0.3rem', fontFamily:"'Space Mono',monospace" }}>
        {pct}% of {max}
      </div>
    </div>
  )
}

export default function ChecklistView() {
  const { projectId, checklistId } = useParams()
  const { isConsultant, user }     = useAuth()
  const navigate = useNavigate()

  const [checklist, setChecklist] = useState(null)
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [projectLanguage, setProjectLanguage] = useState('en')

  const [selected, setSelected]   = useState(new Set())
  const [showEmail, setShowEmail] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask]     = useState({ title:'', description:'', task_type:'document', priority:5 })
  const [adding, setAdding]       = useState(false)

  // IA extraction
  const [showAI, setShowAI]               = useState(false)
  const [aiDraft, setAiDraft]             = useState(null)
  const [aiTitle, setAiTitle]             = useState('')
  const [aiExtracting, setAiExtracting]   = useState(false)
  const [aiError, setAiError]             = useState('')
  const fileRef = useRef()

  // Filtres
  const [filterType,   setFilterType]   = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { loadAll() }, [checklistId])

  async function loadAll() {
    setLoading(true)
    try {
      const [clRes, tRes] = await Promise.all([
        api.get(`/checklists/${checklistId}`),
        api.get(`/checklists/${checklistId}/tasks`),
      ])
      setChecklist(clRes.data)
      setTasks(tRes.data)
      // Charger la langue du projet pour le EmailModal
      try {
        const pRes = await api.get(`/projects/${projectId}`)
        setProjectLanguage(pRes.data.language || 'en')
      } catch { /* langue par défaut */ }
    } catch (err) {
      setError('Failed to load checklist: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(taskId) {
    const s = new Set(selected)
    s.has(taskId) ? s.delete(taskId) : s.add(taskId)
    setSelected(s)
  }

  async function addTask(e) {
    e.preventDefault()
    setAdding(true)
    try {
      await api.post(`/checklists/${checklistId}/tasks`, newTask)
      setNewTask({ title:'', description:'', task_type:'document', priority:5 })
      setShowAddTask(false)
      loadAll()
    } catch (err) { alert(err.message) }
    finally       { setAdding(false) }
  }

  async function handleRfpUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setAiExtracting(true); setAiError(''); setAiDraft(null)
    const form = new FormData()
    form.append('rfp', file)
    try {
      const res = await api.post(`/projects/${projectId}/checklists/ai-extract`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      })
      setAiDraft(res.data.tasks)
      setAiTitle(`${file.name.replace('.pdf', '')} — AI Checklist`)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiExtracting(false)
      e.target.value = ''
    }
  }

  async function validateAiDraft() {
    if (aiDraft.length === 0) { setAiError('No tasks to add.'); return }
    setAiExtracting(true)
    setAiError('')
    try {
      // Ajout dans la checklist COURANTE — pas de nouvelle checklist créée
      for (const task of aiDraft) {
        await api.post(`/checklists/${checklistId}/tasks`, {
          title:       task.title,
          description: task.description || null,
          task_type:   task.task_type   || 'document',
          priority:    task.priority    || 5,
        })
      }
      setShowAI(false)
      setAiDraft(null)
      setAiTitle('')
      loadAll()
    } catch (err) {
      setAiError('Failed to save tasks: ' + err.message)
    } finally {
      setAiExtracting(false)
    }
  }

  // Statistiques
  const totalTasks     = tasks.length
  const completedTasks = tasks.filter(t => ['received','validated'].includes(t.status)).length
  const totalDocs      = tasks.filter(t => t.task_type === 'document').length
  const receivedDocs   = tasks.filter(t => t.task_type === 'document' && ['received','validated'].includes(t.status)).length
  const totalAccess    = tasks.filter(t => t.task_type === 'access').length
  const grantedAccess  = tasks.filter(t => t.task_type === 'access' && ['received','validated'].includes(t.status)).length

  const filteredTasks = tasks.filter(t => {
    if (filterType   !== 'all' && t.task_type !== filterType)   return false
    if (filterStatus !== 'all' && t.status    !== filterStatus) return false
    return true
  })

  const selectedTaskObjs = tasks.filter(t => selected.has(t.id))

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'2rem', color:'#8888a0' }}>
      <span className="spinner" /> Loading checklist…
    </div>
  )
  if (!checklist) return <div className="alert alert-error">{error || 'Checklist not found'}</div>

  return (
    <div>
      {/* Fil d'Ariane */}
      <div style={{ fontSize:'0.8rem', color:'#55555f', marginBottom:'1rem', fontFamily:"'Space Mono',monospace" }}>
        <Link to="/" style={{ color:'#8888a0', textDecoration:'none' }}>Dashboard</Link>
        {' / '}
        <Link to={`/projects/${projectId}/history`} style={{ color:'#8888a0', textDecoration:'none' }}>Project</Link>
        {' / '}
        <span style={{ color:'#e8652a' }}>{checklist.title}</span>
      </div>

      {/* En-tête */}
      <div className="flex-between mb-2">
        <div>
          <h1 style={{ marginBottom:4 }}>{checklist.title}</h1>
          <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
            <span className="badge badge-gray">{checklist.source}</span>
            {checklist.ai_validated === 1 && <span className="badge badge-blue">AI validated</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowAI(true)}>⚡ AI Extract RFP</button>
          <button className="btn btn-ghost" onClick={() => setShowAddTask(true)}>+ Add Task</button>
          {selected.size > 0 && (
            <button className="btn btn-primary" onClick={() => setShowEmail(true)}>
              ✉️ Draft Email ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Score cards */}
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <ScoreCard label="Completed" value={completedTasks} max={totalTasks} color="#e8652a" />
        <ScoreCard label="Documents" value={receivedDocs}   max={totalDocs}  color="#60a5fa" />
        <ScoreCard label="Access"    value={grantedAccess}  max={totalAccess} color="#fbbf24" />
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'0.77rem', color:'#8888a0' }}>Type:</span>
        {['all','document','access','authorization','information'].map(t => (
          <button key={t} className="btn btn-ghost btn-sm"
            style={{ color: filterType === t ? '#e8652a' : '' }}
            onClick={() => setFilterType(t)}>{t}</button>
        ))}
        <span style={{ borderLeft:'1px solid #2e2e33', height:'1.2rem', margin:'0 0.25rem' }} />
        <span style={{ fontSize:'0.77rem', color:'#8888a0' }}>Status:</span>
        {['all','pending','requested','received','validated'].map(s => (
          <button key={s} className="btn btn-ghost btn-sm"
            style={{ color: filterStatus === s ? '#e8652a' : '' }}
            onClick={() => setFilterStatus(s)}>{s}</button>
        ))}
        {selected.size === 0 && filteredTasks.length > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }}
            onClick={() => setSelected(new Set(filteredTasks.map(t => t.id)))}>
            Select all
          </button>
        )}
        {selected.size > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }}
            onClick={() => setSelected(new Set())}>
            Clear {selected.size}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Liste des tâches */}
      {filteredTasks.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem', color:'#8888a0' }}>
          <p>No tasks match the current filters. Add a task or extract from an RFP.</p>
        </div>
      ) : (
        filteredTasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onRefresh={loadAll}
            onSelectToggle={toggleSelect}
            selected={selected.has(task.id)}
          />
        ))
      )}

      {/* Modal ajouter une tâche */}
      {showAddTask && (
        <div className="modal-overlay" onClick={() => setShowAddTask(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Task</h2>
              <button className="btn-icon" onClick={() => setShowAddTask(false)}>✕</button>
            </div>
            <form onSubmit={addTask}>
              <div className="form-group">
                <label>Task title *</label>
                <input autoFocus required value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g. Signed NDA document" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div className="form-group">
                  <label>Type</label>
                  <select value={newTask.task_type} onChange={e => setNewTask({ ...newTask, task_type: e.target.value })}>
                    <option value="document">Document</option>
                    <option value="access">Access</option>
                    <option value="authorization">Authorization</option>
                    <option value="information">Information</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority (1 = high)</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: parseInt(e.target.value) })}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea rows={2} value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  style={{ resize:'vertical' }} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddTask(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? 'Adding…' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal extraction IA */}
      {showAI && (
        <div className="modal-overlay" onClick={() => { setShowAI(false); setAiDraft(null) }}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ AI Requirement Extraction</h2>
              <button className="btn-icon" onClick={() => { setShowAI(false); setAiDraft(null) }}>✕</button>
            </div>

            {!aiDraft ? (
              <>
                <p style={{ marginBottom:'1rem' }}>
                  Upload an RFP PDF. The AI extracts likely required documents and accesses.
                  You review and validate before anything is saved.
                </p>
                <div className="alert alert-info" style={{ marginBottom:'1rem', fontSize:'0.82rem' }}>
                  ℹ️ AI service must be running (port 8000). First call downloads the model (~1.5 GB, ~3 min).
                </div>
                {aiError && <div className="alert alert-error">{aiError}</div>}
                <label style={{ display:'flex', alignItems:'center', gap:'0.75rem', cursor:'pointer' }}>
                  <span className="btn btn-primary">
                    {aiExtracting ? <><span className="spinner" /> Analysing PDF…</> : '📄 Upload RFP PDF'}
                  </span>
                  <input ref={fileRef} type="file" accept=".pdf" onChange={handleRfpUpload} style={{ display:'none' }} disabled={aiExtracting} />
                  {aiExtracting && <span style={{ fontSize:'0.82rem', color:'#fbbf24' }}>This may take a minute…</span>}
                </label>
              </>
            ) : (
              <>
                <div className="alert alert-warn" style={{ marginBottom:'1rem', fontSize:'0.82rem' }}>
                  ⚠️ Review the AI-generated tasks. Remove any that don't apply, then validate to save.
                </div>
                <div style={{ maxHeight:320, overflowY:'auto', marginBottom:'1rem' }}>
                  {aiDraft.map((t, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0', borderBottom:'1px solid #2e2e33' }}>
                      <span style={{ fontSize:'0.78rem', padding:'0.15rem 0.4rem', borderRadius:4, background:'#222', color:'#8888a0', flexShrink:0, fontFamily:"'Space Mono',monospace" }}>
                        {t.task_type}
                      </span>
                      <span style={{ flex:1, fontSize:'0.88rem' }}>{t.title}</span>
                      <button className="btn-icon" style={{ color:'#f87171' }}
                        onClick={() => setAiDraft(aiDraft.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
                {aiError && <div className="alert alert-error">{aiError}</div>}
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setAiDraft(null)}>← Re-upload</button>
                  <button className="btn btn-primary" onClick={validateAiDraft} disabled={aiExtracting}>
                    {aiExtracting ? <><span className="spinner" /> Saving…</> : `✓ Add ${aiDraft.length} tasks to this checklist`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmail && (
        <EmailModal
          projectId={projectId}
          selectedTasks={selectedTaskObjs}
          consultantName={user?.name}
          projectLanguage={projectLanguage}
          onClose={() => setShowEmail(false)}
          onSent={() => { setSelected(new Set()); loadAll() }}
        />
      )}
    </div>
  )
}