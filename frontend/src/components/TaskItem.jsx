/**
 * components/TaskItem.jsx
 * Single task row — all controls always visible (consultant/admin only app).
 */
import React, { useState } from 'react'
import api from '../services/api'

const TYPE_ICONS  = { document: '📄', access: '🔑', authorization: '🛡️', information: 'ℹ️' }
const TYPE_COLORS = { document: '#60a5fa', access: '#fbbf24', authorization: '#a78bfa', information: '#34d399' }

const STATUS_MAP = {
  pending:   { label: 'Pending',   cls: 'badge-gray'   },
  requested: { label: 'Requested', cls: 'badge-yellow'  },
  received:  { label: 'Received',  cls: 'badge-blue'    },
  validated: { label: 'Validated', cls: 'badge-green'   },
}

export default function TaskItem({ task, onRefresh, onSelectToggle, selected }) {
  const [editing, setEditing]     = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDesc, setEditDesc]   = useState(task.description || '')
  const [editType, setEditType]   = useState(task.task_type)
  const [editPrio, setEditPrio]   = useState(task.priority)
  const [editEmail, setEditEmail] = useState(task.assigned_to_email || '')
  const [saving, setSaving]       = useState(false)

  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [expanded, setExpanded]       = useState(false)
  const [documents, setDocuments]     = useState(null)
  const [loadingDocs, setLoadingDocs] = useState(false)

  const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.pending

  // ── Edit ──────────────────────────────────────────────────
  async function saveEdit() {
    setSaving(true)
    try {
      await api.put(`/tasks/${task.id}`, {
        title:             editTitle,
        description:       editDesc,
        task_type:         editType,
        priority:          parseInt(editPrio, 10),
        assigned_to_email: editEmail,
      })
      setEditing(false)
      onRefresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────
  async function deleteTask() {
    if (!window.confirm(`Delete task "${task.title}"?`)) return
    try {
      await api.delete(`/tasks/${task.id}`)
      onRefresh()
    } catch (err) {
      alert(err.message)
    }
  }

  // ── Status ────────────────────────────────────────────────
  async function changeStatus(status) {
    try {
      await api.patch(`/tasks/${task.id}/status`, { status })
      onRefresh()
    } catch (err) {
      alert(err.message)
    }
  }

  // ── Documents ────────────────────────────────────────────
  async function loadDocuments() {
    if (documents !== null) return
    setLoadingDocs(true)
    try {
      const res = await api.get(`/tasks/${task.id}/documents`)
      setDocuments(res.data)
    } catch {
      setDocuments([])
    } finally {
      setLoadingDocs(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/tasks/${task.id}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDocuments(null)   // force reload
      loadDocuments()
      onRefresh()
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function toggleExpand() {
    setExpanded(!expanded)
    if (!expanded) loadDocuments()
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #2e2e33',
      borderLeft: `3px solid ${TYPE_COLORS[task.task_type] || '#555'}`,
      borderRadius: 8, marginBottom: '0.5rem', transition: '0.15s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem' }}>

        {/* Checkbox for email selection */}
        <input
          type="checkbox" checked={selected}
          onChange={() => onSelectToggle(task.id)}
          style={{ flexShrink: 0 }}
        />

        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{TYPE_ICONS[task.task_type] || '📄'}</span>

        {editing ? (
          /* ── Edit form ── */
          <div style={{ flex: 1, display: 'grid', gap: '0.5rem' }}>
            <input
              value={editTitle} onChange={e => setEditTitle(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select value={editType} onChange={e => setEditType(e.target.value)}>
                <option value="document">Document</option>
                <option value="access">Access</option>
                <option value="authorization">Authorization</option>
                <option value="information">Information</option>
              </select>
              <select value={editPrio} onChange={e => setEditPrio(e.target.value)}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>Priority {n}</option>
                ))}
              </select>
              <input
                value={editEmail} onChange={e => setEditEmail(e.target.value)}
                placeholder="assigned email"
              />
            </div>
            <textarea
              rows={2} value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              style={{ resize: 'vertical', fontSize: '0.83rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          /* ── Read row ── */
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#e8e8ea' }}>{task.title}</div>
              {task.assigned_to_email && (
                <div style={{ fontSize: '0.75rem', color: '#8888a0', fontFamily: "'Space Mono',monospace", marginTop: 2 }}>
                  → {task.assigned_to_email}
                </div>
              )}
            </div>

            <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>

            {task.document_count > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontFamily: "'Space Mono',monospace" }}>
                {task.document_count} file{task.document_count !== 1 ? 's' : ''}
              </span>
            )}

            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              <button className="btn-icon" title="Expand / collapse" onClick={toggleExpand}>
                {expanded ? '▴' : '▾'}
              </button>
              <button className="btn-icon" title="Edit task" onClick={() => setEditing(true)}>✎</button>
              <button
                className="btn-icon" title="Delete task" onClick={deleteTask}
                style={{ color: '#f87171' }}
              >✕</button>
            </div>
          </>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && !editing && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #2e2e33' }}>
          {task.description && (
            <p style={{ fontSize: '0.83rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              {task.description}
            </p>
          )}

          {/* Quick status controls */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.77rem', color: '#8888a0' }}>Mark as:</span>
            {['pending', 'requested', 'received', 'validated'].map(s => (
              <button
                key={s} className="btn btn-ghost btn-sm"
                style={{ color: task.status === s ? '#e8652a' : '' }}
                onClick={() => changeStatus(s)}
              >{s}</button>
            ))}
          </div>

          {/* File upload */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <span className="btn btn-ghost btn-sm">
                {uploading ? 'Uploading…' : '↑ Upload document'}
              </span>
              <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
            {uploadError && (
              <div className="alert alert-error" style={{ marginTop: 4, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
                {uploadError}
              </div>
            )}
          </div>

          {/* Document list */}
          {loadingDocs && <p style={{ fontSize: '0.8rem', color: '#8888a0' }}>Loading files…</p>}
          {documents && documents.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#55555f' }}>No files uploaded yet.</p>
          )}
          {documents && documents.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#55555f', fontFamily: "'Space Mono',monospace", marginBottom: '0.3rem' }}>
                UPLOADED FILES
              </div>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderTop: '1px solid #2e2e33' }}>
                  <span style={{ fontSize: '0.83rem', color: '#e8e8ea' }}>📄 {doc.filename}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#55555f' }}>{doc.uploader_name}</span>
                    <a href={`/api/documents/${doc.id}/download`} className="btn btn-ghost btn-sm" download>↓</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}