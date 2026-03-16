/**
 * components/TaskItem.jsx — V3
 *
 * Nouveautés :
 *  - Document courant : boutons Télécharger, Remplacer, Supprimer
 *  - "Remplacer" : modal avec 2 options (version antérieure / supprimer l'original)
 *  - "Historique des versions" : bouton qui affiche les versions archivées
 */
import React, { useState } from 'react'
import api from '../services/api'

const TYPE_ICONS  = { document:'📄', access:'🔑', authorization:'🛡️', information:'ℹ️' }
const TYPE_COLORS = { document:'#60a5fa', access:'#fbbf24', authorization:'#a78bfa', information:'#34d399' }
const STATUS_MAP  = {
  pending:   { label:'Pending',   cls:'badge-gray'   },
  requested: { label:'Requested', cls:'badge-yellow'  },
  received:  { label:'Received',  cls:'badge-blue'    },
  validated: { label:'Validated', cls:'badge-green'   },
}

/* ── Modale de remplacement de document ─────────────────────── */
function ReplaceModal({ doc, onClose, onDone }) {
  const [file,    setFile]    = useState(null)
  const [action,  setAction]  = useState('version')   // 'version' | 'delete_original'
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function submit() {
    if (!file) { setError('Please select a file'); return }
    setLoading(true); setError('')
    const form = new FormData()
    form.append('file', file)
    form.append('action', action)
    try {
      await api.post(`/documents/${doc.id}/replace`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onDone()
      onClose()
    } catch (err) { setError(err.message) }
    finally       { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Replace Document</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize:'0.85rem', color:'var(--text-dim)', marginBottom:'1rem' }}>
          Replacing: <strong style={{ color:'var(--text-dim)' }}>{doc.filename}</strong> (v{doc.version_number})
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Sélection du fichier */}
        <div className="form-group">
          <label>New file *</label>
          <input type="file" onChange={e => setFile(e.target.files[0])}
            style={{ padding:'0.4rem', background:'transparent', border:'1px solid #2e2e33', borderRadius:6, color:'var(--text-dim)', width:'100%' }} />
        </div>

        {/* Choix de l'action */}
        <div className="form-group">
          <label>What to do with the original?</label>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginTop:'0.25rem' }}>
            <label style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', cursor:'pointer',
              padding:'0.75rem', border:`1px solid ${action === 'version' ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius:6, background: action === 'version' ? 'var(--accent-soft)' : 'var(--bg-hover)' }}>
              <input type="radio" name="action" value="version"
                checked={action === 'version'} onChange={() => setAction('version')}
                style={{ width:'auto', marginTop:2 }} />
              <div>
                <div style={{ fontWeight:500, color:'var(--text-dim)', fontSize:'0.88rem' }}>
                  📚 Keep as previous version
                </div>
                <div style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginTop:2 }}>
                  The original is archived and visible in version history. Nothing is deleted.
                </div>
              </div>
            </label>

            <label style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', cursor:'pointer',
              padding:'0.75rem', border:`1px solid ${action === 'delete_original' ? '#f87171' : 'var(--bg)'}`,
              borderRadius:6, background: action === 'delete_original' ? 'rgba(248,113,113,0.06)' : 'var(--bg)' }}>
              <input type="radio" name="action" value="delete_original"
                checked={action === 'delete_original'} onChange={() => setAction('delete_original')}
                style={{ width:'auto', marginTop:2 }} />
              <div>
                <div style={{ fontWeight:500, color:'#f87171', fontSize:'0.88rem' }}>
                  🗑️ Delete original
                </div>
                <div style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginTop:2 }}>
                  The original file is permanently deleted. This cannot be undone.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${action === 'delete_original' ? 'btn-danger' : 'btn-primary'}`}
            onClick={submit} disabled={loading || !file}
          >
            {loading ? <><span className="spinner" /> Uploading…</> : 'Confirm Replace'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Composant principal ─────────────────────────────────────── */
export default function TaskItem({ task, onRefresh, onSelectToggle, selected }) {
  /* Édition */
  const [editing,   setEditing]   = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDesc,  setEditDesc]  = useState(task.description || '')
  const [editType,  setEditType]  = useState(task.task_type)
  const [editPrio,  setEditPrio]  = useState(task.priority)
  const [editEmail, setEditEmail] = useState(task.assigned_to_email || '')
  const [saving,    setSaving]    = useState(false)

  /* Documents */
  const [expanded,    setExpanded]    = useState(false)
  const [documents,   setDocuments]   = useState(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [replaceDoc,  setReplaceDoc]  = useState(null)   // doc en cours de remplacement

  const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.pending

  /* ── Tâche : edit / delete / status ─── */
  async function saveEdit() {
    setSaving(true)
    try {
      await api.put(`/tasks/${task.id}`, {
        title: editTitle, description: editDesc, task_type: editType,
        priority: parseInt(editPrio, 10), assigned_to_email: editEmail,
      })
      setEditing(false); onRefresh()
    } catch (err) { alert(err.message) }
    finally       { setSaving(false) }
  }

  async function deleteTask() {
    if (!window.confirm(`Delete task "${task.title}"?`)) return
    try { await api.delete(`/tasks/${task.id}`); onRefresh() }
    catch (err) { alert(err.message) }
  }

  async function changeStatus(status) {
    try { await api.patch(`/tasks/${task.id}/status`, { status }); onRefresh() }
    catch (err) { alert(err.message) }
  }

  /* ── Documents ─────────────────────────── */
  async function loadDocuments() {
    setLoadingDocs(true)
    try {
      const res = await api.get(`/tasks/${task.id}/documents`)
      setDocuments(res.data)
    } catch { setDocuments([]) }
    finally  { setLoadingDocs(false) }
  }

  function toggleExpand() {
    if (!expanded) loadDocuments()
    setExpanded(!expanded)
    setShowHistory(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true); setUploadError('')
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/tasks/${task.id}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadDocuments(); onRefresh()
    } catch (err) { setUploadError(err.message) }
    finally       { setUploading(false); e.target.value = '' }
  }

  async function deleteDocument(docId) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    try {
      await api.delete(`/documents/${docId}`)
      await loadDocuments(); onRefresh()
    } catch (err) { alert(err.message) }
  }

  /* Séparer version courante et historique */
  const currentDocs  = (documents || []).filter(d => d.is_current)
  const historyDocs  = (documents || []).filter(d => !d.is_current)

  /* ── Render ────────────────────────────── */
  return (
    <>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${TYPE_COLORS[task.task_type] || '#555'}`,
        borderRadius: 8, marginBottom: '0.5rem',
      }}>
        {/* Ligne principale */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.85rem 1rem' }}>
          <input type="checkbox" checked={selected} onChange={() => onSelectToggle(task.id)} style={{ flexShrink:0 }} />
          <span style={{ fontSize:'1rem', flexShrink:0 }}>{TYPE_ICONS[task.task_type] || '📄'}</span>

          {editing ? (
            /* Formulaire d'édition */
            <div style={{ flex:1, display:'grid', gap:'0.5rem' }}>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ fontSize:'0.88rem' }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem' }}>
                <select value={editType} onChange={e => setEditType(e.target.value)}>
                  {['document','access','authorization','information'].map(t =>
                    <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={editPrio} onChange={e => setEditPrio(e.target.value)}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Priority {n}</option>)}
                </select>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="assigned email" />
              </div>
              <textarea rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)}
                placeholder="Description" style={{ resize:'vertical', fontSize:'0.83rem' }} />
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                  {saving ? 'Saving…' : '✓ Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            /* Vue lecture */
            <>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:'0.9rem', color:'var(--text)' }}>{task.title}</div>
                {task.assigned_to_email && (
                  <div style={{ fontSize:'0.75rem', color:'var(--text-dim)', fontFamily:"'Space Mono',monospace", marginTop:2 }}>
                    → {task.assigned_to_email}
                  </div>
                )}
              </div>
              <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
              {task.document_count > 0 && (
                <span style={{ fontSize:'0.75rem', color:'#60a5fa', fontFamily:"'Space Mono',monospace" }}>
                  {task.document_count} file{task.document_count !== 1 ? 's' : ''}
                </span>
              )}
              <div style={{ display:'flex', gap:'0.25rem', flexShrink:0 }}>
                <button className="btn-icon" title="Expand" onClick={toggleExpand}>
                  {expanded ? '▴' : '▾'}
                </button>
                <button className="btn-icon" title="Edit" onClick={() => setEditing(true)}>✎</button>
                <button className="btn-icon" title="Delete task" onClick={deleteTask} style={{ color:'#f87171' }}>✕</button>
              </div>
            </>
          )}
        </div>

        {/* Panneau déplié */}
        {expanded && !editing && (
          <div style={{ padding:'0 1rem 1rem', borderTop:'1px solid #2e2e33' }}>
            {task.description && (
              <p style={{ fontSize:'0.83rem', marginTop:'0.75rem', marginBottom:'0.75rem' }}>
                {task.description}
              </p>
            )}

            {/* Contrôles de statut */}
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem', alignItems:'center' }}>
              <span style={{ fontSize:'0.77rem', color:'var(--text-dim)' }}>Mark as:</span>
              {['pending','requested','received','validated'].map(s => (
                <button key={s} className="btn btn-ghost btn-sm"
                  style={{ color: task.status === s ? '#d6062b' : '' }}
                  onClick={() => changeStatus(s)}>{s}</button>
              ))}
            </div>

            {/* ── Section documents ── */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'0.75rem' }}>
              <div className="flex-between" style={{ marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'0.73rem', color:'var(--text-dim)', fontFamily:"'Space Mono',monospace" }}>
                  DOCUMENTS
                </span>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {historyDocs.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory(!showHistory)}>
                      {showHistory ? 'Hide history' : `Version history (${historyDocs.length})`}
                    </button>
                  )}
                  <label style={{ cursor:'pointer' }}>
                    <span className="btn btn-ghost btn-sm">
                      {uploading ? 'Uploading…' : '↑ Upload'}
                    </span>
                    <input type="file" onChange={handleFileUpload} style={{ display:'none' }} disabled={uploading} />
                  </label>
                </div>
              </div>

              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom:'0.5rem', padding:'0.4rem 0.6rem', fontSize:'0.8rem' }}>
                  {uploadError}
                </div>
              )}

              {loadingDocs && <p style={{ fontSize:'0.8rem', color:'var(--text-dim)' }}>Loading…</p>}

              {/* Document courant */}
              {currentDocs.length === 0 && !loadingDocs && (
                <p style={{ fontSize:'0.8rem', color:'var(--text-dim)' }}>No file uploaded yet.</p>
              )}

              {currentDocs.map(doc => (
                <div key={doc.id} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'0.6rem 0.75rem', background:'var(--bg-hover)', borderRadius:6, marginBottom:'0.25rem',
                  border:'1px solid var(--border)',
                }}>
                  <div>
                    <span style={{ fontSize:'0.85rem', color:'var(--text-dim)' }}>📄 {doc.filename}</span>
                    <span style={{ fontSize:'0.72rem', color:'#34d399', fontFamily:"'Space Mono',monospace", marginLeft:'0.6rem' }}>
                      v{doc.version_number} (current)
                    </span>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginTop:2 }}>
                      {doc.uploader_name} · {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'0.35rem' }}>
                    <a href={`/api/documents/${doc.id}/download`}
                      className="btn btn-ghost btn-sm" download title="Download">↓</a>
                    <button className="btn btn-ghost btn-sm" title="Replace"
                      onClick={() => setReplaceDoc(doc)}>↺ Replace</button>
                    <button className="btn-icon" title="Delete this version"
                      style={{ color:'#f87171' }} onClick={() => deleteDocument(doc.id)}>✕</button>
                  </div>
                </div>
              ))}

              {/* Historique des versions */}
              {showHistory && historyDocs.length > 0 && (
                <div style={{ marginTop:'0.5rem' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', fontFamily:"'Space Mono',monospace", marginBottom:'0.3rem' }}>
                    PREVIOUS VERSIONS
                  </div>
                  {historyDocs.map(doc => (
                    <div key={doc.id} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'0.5rem 0.75rem', background:'#111113', borderRadius:6, marginBottom:'0.25rem',
                      border:'1px solid #2e2e33', opacity:0.7,
                    }}>
                      <div>
                        <span style={{ fontSize:'0.83rem', color:'var(--text-dim)' }}>📄 {doc.filename}</span>
                        <span style={{ fontSize:'0.72rem', color:'var(--text-dim)', fontFamily:"'Space Mono',monospace", marginLeft:'0.5rem' }}>
                          v{doc.version_number}
                        </span>
                        <div style={{ fontSize:'0.72rem', color:'#3a3a40' }}>
                          {doc.uploader_name} · {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'0.35rem' }}>
                        <a href={`/api/documents/${doc.id}/download`}
                          className="btn btn-ghost btn-sm" download title="Download">↓</a>
                        <button className="btn-icon" title="Delete this version"
                          style={{ color:'#f87171' }} onClick={() => deleteDocument(doc.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modale de remplacement */}
      {replaceDoc && (
        <ReplaceModal
          doc={replaceDoc}
          onClose={() => setReplaceDoc(null)}
          onDone={() => { loadDocuments(); onRefresh() }}
        />
      )}
    </>
  )
}