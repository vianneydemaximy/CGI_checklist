/**
 * pages/History.jsx
 * Audit trail for a project — shows all events chronologically.
 */
import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'

const ACTION_ICON = {
  'auth.login':              '🔑',
  'project.created':         '📁',
  'project.updated':         '✏️',
  'project.deleted':         '🗑️',
  'checklist.created':       '📋',
  'checklist.ai_draft_generated': '⚡',
  'checklist.ai_validated':  '✅',
  'checklist.updated':       '✏️',
  'checklist.deleted':       '🗑️',
  'task.created':            '➕',
  'task.updated':            '✏️',
  'task.deleted':            '🗑️',
  'task.status_changed':     '🔄',
  'document.uploaded':       '📄',
  'document.deleted':        '🗑️',
  'email.draft_generated':   '📝',
  'email.sent':              '✉️',
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)     return `${Math.round(diff)}s ago`
  if (diff < 3600)   return `${Math.round(diff/60)}m ago`
  if (diff < 86400)  return `${Math.round(diff/3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function History() {
  const { projectId } = useParams()
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    api.get(`/projects/${projectId}/history`)
      .then(res => setLogs(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <div style={{ padding:'2rem', color:'#8888a0', display:'flex', gap:'0.75rem', alignItems:'center' }}><span className="spinner" /> Loading history…</div>

  return (
    <div>
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ fontSize:'0.8rem', color:'#55555f', marginBottom:'0.5rem', fontFamily:"'Space Mono',monospace" }}>
          <Link to="/" style={{ color:'#8888a0', textDecoration:'none' }}>Dashboard</Link> / Audit History
        </div>
        <h1>Project History</h1>
        <p style={{ marginTop:4 }}>{logs.length} events recorded</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {logs.length === 0 && !error && (
        <div className="card" style={{ textAlign:'center', padding:'3rem', color:'#8888a0' }}>
          No activity recorded yet for this project.
        </div>
      )}

      {/* Timeline */}
      <div style={{ position:'relative' }}>
        {logs.map((log, i) => (
          <div key={log.id} style={{ display:'flex', gap:'1rem', marginBottom:'0.5rem' }}>
            {/* Icon column */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:36, flexShrink:0 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#222', border:'1px solid #2e2e33',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>
                {ACTION_ICON[log.action] || '📌'}
              </div>
              {i < logs.length - 1 && <div style={{ flex:1, width:1, background:'#2e2e33', minHeight:12 }} />}
            </div>

            {/* Content */}
            <div style={{ flex:1, background:'#18181b', border:'1px solid #2e2e33', borderRadius:8, padding:'0.75rem 1rem', marginBottom:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
                <div>
                  <span style={{ fontFamily:"'Space Mono',monospace", fontSize:'0.78rem', color:'#e8652a' }}>{log.action}</span>
                  {log.user_name && (
                    <span style={{ fontSize:'0.78rem', color:'#8888a0', marginLeft:'0.5rem' }}>by {log.user_name}</span>
                  )}
                </div>
                <span style={{ fontSize:'0.72rem', color:'#55555f', whiteSpace:'nowrap', fontFamily:"'Space Mono',monospace" }}>
                  {timeAgo(log.created_at)}
                </span>
              </div>

              {log.details && Object.keys(JSON.parse(log.details || '{}')).length > 0 && (
                <div style={{ marginTop:'0.4rem', fontSize:'0.78rem', color:'#55555f', fontFamily:"'Space Mono',monospace" }}>
                  {Object.entries(JSON.parse(log.details)).map(([k, v]) => (
                    <span key={k} style={{ marginRight:'1rem' }}>{k}: <span style={{ color:'#8888a0' }}>{String(v)}</span></span>
                  ))}
                </div>
              )}

              <div style={{ fontSize:'0.72rem', color:'#3a3a40', marginTop:'0.25rem', fontFamily:"'Space Mono',monospace" }}>
                {log.entity_type}#{log.entity_id}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}