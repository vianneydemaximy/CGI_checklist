/**
 * pages/Templates.jsx — V2
 *
 * Deux onglets :
 *   - Checklist Templates : templates de listes de tâches
 *   - Email Templates     : formulations d'emails avec placeholders
 *
 * Règles de visibilité / modification :
 *   - is_global = true  → visible par tous, modifiable par admin uniquement
 *   - is_global = false → visible et modifiable par le créateur uniquement
 *
 * Placeholders disponibles dans les templates email :
 *   {{recipient_name}}, {{task_list}}, {{consultant_name}}, {{deadline}}
 */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

/* ── Constantes ──────────────────────────────────────────────── */
const TASK_TYPES   = ['document', 'access', 'authorization', 'information']
const TYPE_COLORS  = { document:'#60a5fa', access:'#fbbf24', authorization:'#a78bfa', information:'#34d399' }
const PLACEHOLDERS = '{{recipient_name}}  {{task_list}}  {{consultant_name}}  {{deadline}}'

const EMPTY_CHECKLIST_ITEM = { title:'', description:'', task_type:'document', priority:5 }
const EMPTY_CHECKLIST_TPL  = { name:'', description:'', is_global:false, language:'en', items:[] }
const EMPTY_EMAIL_TPL      = { name:'', description:'', subject:'', body:'', is_global:false, language:'en' }

/* ── Petit badge ─────────────────────────────────────────────── */
function Badge({ global: isGlobal }) {
  return (
    <span style={{
      fontSize:'0.68rem', padding:'0.15rem 0.45rem', borderRadius:999,
      fontFamily:"'Space Mono',monospace",
      background: isGlobal ? 'rgba(96,165,250,0.15)' : 'rgba(136,136,160,0.1)',
      color: isGlobal ? '#60a5fa' : '#8888a0',
    }}>
      {isGlobal ? '🌐 global' : '👤 personal'}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   SECTION CHECKLIST TEMPLATES
════════════════════════════════════════════════════════════════ */
function ChecklistTemplates({ isAdmin, userId }) {
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)   // null = nouveau
  const [form,      setForm]      = useState(EMPTY_CHECKLIST_TPL)
  const [saving,    setSaving]    = useState(false)
  const [preview,   setPreview]   = useState(null)   // template affiché en détail

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/templates')
      setTemplates(res.data)
    } catch (err) { setError(err.message) }
    finally      { setLoading(false) }
  }

  async function openNew() {
    setForm(EMPTY_CHECKLIST_TPL)
    setEditing(null)
    setShowModal(true)
  }

  async function openEdit(tpl) {
    const res = await api.get(`/templates/${tpl.id}`)
    setForm({ name: res.data.name, description: res.data.description || '', is_global: !!res.data.is_global, items: res.data.items || [] })
    setEditing(tpl.id)
    setShowModal(true)
  }

  async function openPreview(tpl) {
    const res = await api.get(`/templates/${tpl.id}`)
    setPreview(res.data)
  }

  async function save() {
    if (!form.name.trim()) { setError('Template name is required'); return }
    setSaving(true); setError('')
    try {
      if (editing) {
        await api.put(`/templates/${editing}`, form)
      } else {
        await api.post('/templates', form)
      }
      setShowModal(false)
      load()
    } catch (err) { setError(err.message) }
    finally       { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this template?')) return
    try { await api.delete(`/templates/${id}`); load() }
    catch (err) { setError(err.message) }
  }

  /* Items management */
  function addItem()            { setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_CHECKLIST_ITEM }] })) }
  function removeItem(i)        { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })) }
  function updateItem(i, field, val) {
    setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [field]: val }; return { ...f, items } })
  }

  const canEdit = (tpl) => isAdmin || tpl.created_by === userId

  if (loading) return <div style={{ color:'#8888a0', padding:'1rem', display:'flex', gap:'0.5rem', alignItems:'center' }}><span className="spinner" /> Loading…</div>

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex-between mb-2">
        <p style={{ fontSize:'0.88rem' }}>
          Predefined task lists cloned when creating a new project.
        </p>
        <button className="btn btn-primary" onClick={openNew}>+ New Template</button>
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem', color:'#8888a0' }}>
          No templates yet. Create one to speed up project setup.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem' }}>
          {templates.map(tpl => (
            <div key={tpl.id} className="card" style={{ position:'relative' }}>
              <div className="flex-between" style={{ marginBottom:'0.5rem' }}>
                <div style={{ display:'flex', gap:'0.4rem' }}>
                  <Badge global={!!tpl.is_global} />
                  <span style={{ fontSize:'0.72rem' }}>{tpl.language === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                </div>
                <span className="mono">{tpl.item_count || 0} items</span>
              </div>
              <h3 style={{ color:'#e8e8ea', marginBottom:'0.3rem' }}>{tpl.name}</h3>
              {tpl.description && <p style={{ fontSize:'0.82rem', marginBottom:'0.75rem' }}>{tpl.description}</p>}
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.75rem', borderTop:'1px solid #2e2e33', paddingTop:'0.75rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openPreview(tpl)}>Preview</button>
                {canEdit(tpl) && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tpl)}>✎ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(tpl.id)}>✕</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{preview.name}</h2>
                <Badge global={!!preview.is_global} />
              </div>
              <button className="btn-icon" onClick={() => setPreview(null)}>✕</button>
            </div>
            {preview.description && <p style={{ marginBottom:'1rem', fontSize:'0.88rem' }}>{preview.description}</p>}
            <div style={{ fontSize:'0.75rem', color:'#55555f', fontFamily:"'Space Mono',monospace", marginBottom:'0.5rem' }}>
              {preview.items?.length || 0} TASKS
            </div>
            {(preview.items || []).map((item, i) => (
              <div key={i} style={{ display:'flex', gap:'0.75rem', padding:'0.5rem 0', borderBottom:'1px solid #2e2e33', alignItems:'center' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: TYPE_COLORS[item.task_type] || '#555', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.87rem', color:'#e8e8ea' }}>{item.title}</div>
                  {item.description && <div style={{ fontSize:'0.75rem', color:'#8888a0' }}>{item.description}</div>}
                </div>
                <span style={{ fontSize:'0.7rem', color:'#55555f', fontFamily:"'Space Mono',monospace" }}>
                  p{item.priority}
                </span>
              </div>
            ))}
            <div style={{ marginTop:'1.5rem', textAlign:'right' }}>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Template' : 'New Checklist Template'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Template name *</label>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Technical Project" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description…" />
            </div>
            <div className="form-group">
              <label>Language</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                {[['en','🇬🇧 English'],['fr','🇫🇷 Français']].map(([k,v]) => (
                  <button key={k} type="button" onClick={() => setForm(f => ({ ...f, language: k }))} style={{
                    flex:1, padding:'0.5rem', borderRadius:6, cursor:'pointer',
                    border:     form.language === k ? '1px solid #e8652a' : '1px solid #2e2e33',
                    background: form.language === k ? 'rgba(232,101,42,0.1)' : '#18181b',
                    color:      form.language === k ? '#e8652a' : '#8888a0',
                    fontSize:'0.82rem',
                  }}>{v}</button>
                ))}
              </div>
            </div>
            {isAdmin && (
              <div className="form-group" style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <input type="checkbox" id="chk-global" checked={form.is_global} onChange={e => setForm(f => ({ ...f, is_global: e.target.checked }))} style={{ width:'auto' }} />
                <label htmlFor="chk-global" style={{ marginBottom:0, cursor:'pointer' }}>
                  Global template (visible to all consultants)
                </label>
              </div>
            )}

            {/* Items */}
            <div style={{ marginTop:'1rem' }}>
              <div className="flex-between" style={{ marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'0.78rem', color:'#55555f', fontFamily:"'Space Mono',monospace" }}>
                  TASKS ({form.items.length})
                </span>
                <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Add task</button>
              </div>

              <div style={{ maxHeight:320, overflowY:'auto' }}>
                {form.items.length === 0 && (
                  <p style={{ color:'#55555f', fontSize:'0.83rem', padding:'0.5rem 0' }}>
                    No tasks yet. Click "+ Add task" to start.
                  </p>
                )}
                {form.items.map((item, i) => (
                  <div key={i} style={{ background:'#111113', border:'1px solid #2e2e33', borderRadius:6, padding:'0.75rem', marginBottom:'0.5rem' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'0.5rem', marginBottom:'0.5rem' }}>
                      <input
                        value={item.title}
                        onChange={e => updateItem(i, 'title', e.target.value)}
                        placeholder={`Task ${i + 1} title`}
                        style={{ fontSize:'0.88rem' }}
                      />
                      <button className="btn-icon" style={{ color:'#f87171' }} onClick={() => removeItem(i)}>✕</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                      <select value={item.task_type} onChange={e => updateItem(i, 'task_type', e.target.value)}>
                        {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select value={item.priority} onChange={e => updateItem(i, 'priority', parseInt(e.target.value))}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Priority {n}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   SECTION EMAIL TEMPLATES
════════════════════════════════════════════════════════════════ */
function EmailTemplates({ isAdmin, userId }) {
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_EMAIL_TPL)
  const [saving,     setSaving]     = useState(false)
  const [preview,    setPreview]    = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/email-templates')
      setTemplates(res.data)
    } catch (err) { setError(err.message) }
    finally      { setLoading(false) }
  }

  function openNew() {
    setForm(EMPTY_EMAIL_TPL)
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(tpl) {
    setForm({ name: tpl.name, description: tpl.description || '', subject: tpl.subject, body: tpl.body, is_global: !!tpl.is_global })
    setEditing(tpl.id)
    setShowModal(true)
  }

  async function save() {
    if (!form.name || !form.subject || !form.body) {
      setError('Name, subject and body are required'); return
    }
    setSaving(true); setError('')
    try {
      if (editing) {
        await api.put(`/email-templates/${editing}`, form)
      } else {
        await api.post('/email-templates', form)
      }
      setShowModal(false); load()
    } catch (err) { setError(err.message) }
    finally       { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this email template?')) return
    try { await api.delete(`/email-templates/${id}`); load() }
    catch (err) { setError(err.message) }
  }

  const canEdit = (tpl) => isAdmin || tpl.created_by === userId

  if (loading) return <div style={{ color:'#8888a0', padding:'1rem', display:'flex', gap:'0.5rem', alignItems:'center' }}><span className="spinner" /> Loading…</div>

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex-between mb-2">
        <div>
          <p style={{ fontSize:'0.88rem' }}>
            Reusable email formulations. Always editable before sending.
          </p>
          <p style={{ fontSize:'0.78rem', color:'#55555f', marginTop:4, fontFamily:"'Space Mono',monospace" }}>
            Placeholders: {PLACEHOLDERS}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Template</button>
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem', color:'#8888a0' }}>
          No email templates. Run the V2 migration SQL to add the default ones.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1rem' }}>
          {templates.map(tpl => (
            <div key={tpl.id} className="card">
              <div className="flex-between" style={{ marginBottom:'0.5rem' }}>
                <div style={{ display:'flex', gap:'0.4rem' }}>
                  <Badge global={!!tpl.is_global} />
                  <span style={{ fontSize:'0.72rem' }}>{tpl.language === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                </div>
                <span style={{ fontSize:'0.72rem', color:'#55555f' }}>{tpl.created_by_name}</span>
              </div>
              <h3 style={{ color:'#e8e8ea', marginBottom:'0.25rem' }}>{tpl.name}</h3>
              {tpl.description && <p style={{ fontSize:'0.82rem', marginBottom:'0.5rem' }}>{tpl.description}</p>}
              <div style={{ fontSize:'0.78rem', color:'#8888a0', padding:'0.4rem 0.6rem', background:'#111113', borderRadius:4, marginBottom:'0.75rem', fontFamily:"'Space Mono',monospace", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {tpl.subject}
              </div>
              <div style={{ display:'flex', gap:'0.5rem', borderTop:'1px solid #2e2e33', paddingTop:'0.75rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPreview(tpl)}>Preview</button>
                {canEdit(tpl) && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tpl)}>✎ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(tpl.id)}>✕</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{preview.name}</h2>
                <Badge global={!!preview.is_global} />
              </div>
              <button className="btn-icon" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ marginBottom:'0.75rem' }}>
              <div style={{ fontSize:'0.73rem', color:'#55555f', fontFamily:"'Space Mono',monospace", marginBottom:'0.25rem' }}>SUBJECT</div>
              <div style={{ background:'#111113', padding:'0.6rem 0.8rem', borderRadius:6, fontSize:'0.88rem', color:'#e8e8ea' }}>{preview.subject}</div>
            </div>
            <div>
              <div style={{ fontSize:'0.73rem', color:'#55555f', fontFamily:"'Space Mono',monospace", marginBottom:'0.25rem' }}>BODY</div>
              <pre style={{ background:'#111113', padding:'1rem', borderRadius:6, fontSize:'0.83rem', color:'#e8e8ea', whiteSpace:'pre-wrap', fontFamily:'inherit', lineHeight:1.65, maxHeight:400, overflowY:'auto', margin:0 }}>
                {preview.body}
              </pre>
            </div>
            <div style={{ marginTop:'1rem', display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
              {canEdit(preview) && (
                <button className="btn btn-ghost" onClick={() => { setPreview(null); openEdit(preview) }}>✎ Edit</button>
              )}
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Email Template' : 'New Email Template'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="alert alert-info" style={{ fontSize:'0.78rem', marginBottom:'1rem' }}>
              Available placeholders — will be replaced automatically:<br />
              <span style={{ fontFamily:"'Space Mono',monospace" }}>{PLACEHOLDERS}</span>
            </div>

            <div className="form-group">
              <label>Template name *</label>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard document request" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="When to use this template…" />
            </div>
            <div className="form-group">
              <label>Subject *</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="[CGI Mission] Document Request" />
            </div>
            <div className="form-group">
              <label>Body * <span style={{ fontSize:'0.72rem', color:'#55555f' }}>(use placeholders above)</span></label>
              <textarea
                rows={12}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder={`Dear {{recipient_name}},\n\nPlease provide:\n\n{{task_list}}\n\nThank you,\n{{consultant_name}}`}
                style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.65, fontSize:'0.88rem' }}
              />
            </div>
            {isAdmin && (
              <div className="form-group" style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <input type="checkbox" id="chk-email-global" checked={form.is_global} onChange={e => setForm(f => ({ ...f, is_global: e.target.checked }))} style={{ width:'auto' }} />
                <label htmlFor="chk-email-global" style={{ marginBottom:0, cursor:'pointer' }}>
                  Global template (visible to all consultants)
                </label>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════════ */
export default function Templates() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('checklist')   // 'checklist' | 'email'

  const tabStyle = (active) => ({
    padding: '0.55rem 1.25rem',
    borderRadius: 6,
    border: active ? '1px solid #e8652a' : '1px solid transparent',
    background: active ? 'rgba(232,101,42,0.1)' : 'transparent',
    color: active ? '#e8652a' : '#8888a0',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: active ? 500 : 400,
    transition: '0.15s',
  })

  return (
    <div>
      {/* En-tête */}
      <div style={{ marginBottom:'1.5rem' }}>
        <h1>Templates</h1>
        <p style={{ marginTop:4 }}>
          Manage checklist and email templates.
          {isAdmin && <span style={{ color:'#e8652a', marginLeft:'0.5rem', fontSize:'0.82rem' }}>Admin — you can create global templates visible to all.</span>}
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem', padding:'0.25rem', background:'#18181b', borderRadius:8, border:'1px solid #2e2e33', width:'fit-content' }}>
        <button style={tabStyle(tab === 'checklist')} onClick={() => setTab('checklist')}>
          📋 Checklist Templates
        </button>
        <button style={tabStyle(tab === 'email')} onClick={() => setTab('email')}>
          ✉️ Email Templates
        </button>
      </div>

      {/* Contenu de l'onglet actif */}
      {tab === 'checklist' && (
        <ChecklistTemplates isAdmin={isAdmin} userId={user?.id} />
      )}
      {tab === 'email' && (
        <EmailTemplates isAdmin={isAdmin} userId={user?.id} />
      )}
    </div>
  )
}