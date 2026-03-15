/**
 * components/EmailModal.jsx — V2
 *
 * 3 modes de génération du brouillon :
 *   1. Template email prédéfini  → remplace les placeholders, sauvegarde via /emails/draft
 *   2. Génération IA             → appel /emails/generate (nécessite AI service)
 *   3. Saisie manuelle libre     → zone de texte vide
 *
 * Flux : Configurer → Rédiger/Réviser → Envoyer (confirmation explicite)
 * Aucun email n'est envoyé sans validation humaine.
 */
import React, { useState, useEffect } from 'react'
import api from '../services/api'

/* Applique les placeholders d'un template sur les données contextuelles */
function applyPlaceholders(text, { recipientName, taskList, consultantName }) {
  return text
    .replace(/\{\{recipient_name\}\}/g,  recipientName  || 'Client')
    .replace(/\{\{task_list\}\}/g,        taskList       || '')
    .replace(/\{\{consultant_name\}\}/g,  consultantName || '[Your Name]')
    .replace(/\{\{deadline\}\}/g,         '[DATE TO FILL IN]')
}

function formatTaskList(tasks) {
  return tasks
    .map((t, i) => `  ${i + 1}. [${t.task_type}] ${t.title}`)
    .join('\n')
}

export default function EmailModal({ projectId, selectedTasks, onClose, onSent, consultantName }) {
  /* ── Étapes : 1=config  2=rédaction  3=envoyé ── */
  const [step, setStep] = useState(1)

  /* Données de configuration */
  const [recipient,      setRecipient]      = useState('')
  const [recipientName,  setRecipientName]  = useState('')
  const [genMode,        setGenMode]        = useState('template') // 'template' | 'ai' | 'manual'
  const [emailTemplates, setEmailTemplates] = useState([])
  const [selectedTplId,  setSelectedTplId]  = useState('')

  /* Données du brouillon */
  const [draftId, setDraftId] = useState(null)
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')

  /* États UI */
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [sending, setSending] = useState(false)

  /* Charger les templates email au montage */
  useEffect(() => {
    api.get('/email-templates')
      .then(r => {
        setEmailTemplates(r.data)
        if (r.data.length > 0) setSelectedTplId(String(r.data[0].id))
      })
      .catch(() => setGenMode('ai'))   // si pas de templates, basculer sur IA
  }, [])

  /* ── Étape 1 → 2 : préparer le brouillon ───────────────── */
  async function prepareDraft() {
    if (!recipient) { setError('Recipient email is required'); return }
    setError('')
    setLoading(true)

    try {
      if (genMode === 'template' && selectedTplId) {
        /* Mode template — pas d'appel IA */
        const tpl = emailTemplates.find(t => String(t.id) === selectedTplId)
        if (!tpl) throw new Error('Template not found')

        const taskList   = formatTaskList(selectedTasks)
        const finalSubj  = applyPlaceholders(tpl.subject, { recipientName, taskList, consultantName })
        const finalBody  = applyPlaceholders(tpl.body,    { recipientName, taskList, consultantName })

        /* Sauvegarder comme brouillon (sans IA) */
        const res = await api.post(`/projects/${projectId}/emails/draft`, {
          recipient_email: recipient,
          subject:         finalSubj,
          body:            finalBody,
          task_ids:        selectedTasks.map(t => t.id),
        })
        setDraftId(res.data.id)
        setSubject(finalSubj)
        setBody(finalBody)

      } else if (genMode === 'ai') {
        /* Mode IA */
        const res = await api.post(`/projects/${projectId}/emails/generate`, {
          task_ids:        selectedTasks.map(t => t.id),
          recipient_email: recipient,
          recipient_name:  recipientName || 'Client',
        })
        setDraftId(res.data.id)
        setSubject(res.data.subject)
        setBody(res.data.body)

      } else {
        /* Mode manuel — brouillon vide sauvegardé */
        const taskList  = formatTaskList(selectedTasks)
        const initBody  = `Dear ${recipientName || 'Client'},\n\nPlease provide the following items:\n\n${taskList}\n\nThank you,\n${consultantName || '[Your Name]'}`
        const res = await api.post(`/projects/${projectId}/emails/draft`, {
          recipient_email: recipient,
          subject:         '[CGI Mission Preparation] Document Request',
          body:            initBody,
          task_ids:        selectedTasks.map(t => t.id),
        })
        setDraftId(res.data.id)
        setSubject('[CGI Mission Preparation] Document Request')
        setBody(initBody)
      }

      setStep(2)
    } catch (err) {
      if (err.message.includes('AI service')) {
        setError('AI service unavailable. Switch to "Template" or "Manual" mode.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Étape 2 → envoi réel ───────────────────────────────── */
  async function sendEmail() {
    if (!window.confirm(`Send this email to ${recipient}? This cannot be undone.`)) return
    setSending(true)
    setError('')
    try {
      await api.post(`/emails/${draftId}/send`, { subject, body })
      setStep(3)
      onSent?.()
    } catch (err) {
      setError('Send failed: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  /* ── Rendu ──────────────────────────────────────────────── */
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div className="modal-header">
          <div>
            <h2>Email Generator</h2>
            <p style={{ fontSize:'0.8rem', marginTop:2 }}>
              {step === 1 && `${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} selected`}
              {step === 2 && 'Review and edit before sending'}
              {step === 3 && 'Email sent'}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Indicateur d'étapes */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
          {['Configure', 'Review & Edit', 'Sent'].map((label, i) => (
            <div key={i} style={{
              flex:1, textAlign:'center', fontSize:'0.75rem', padding:'0.35rem',
              borderRadius:4, fontFamily:"'Space Mono',monospace",
              background: step === i+1 ? '#e8652a' : step > i+1 ? '#064e35' : '#222',
              color:      step === i+1 ? '#fff'    : step > i+1 ? '#34d399' : '#55555f',
            }}>
              {step > i+1 ? '✓ ' : `${i+1}. `}{label}
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ════════════ STEP 1 — Configuration ════════════ */}
        {step === 1 && (
          <>
            {/* Récapitulatif des tâches sélectionnées */}
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'0.73rem', color:'#55555f', fontFamily:"'Space Mono',monospace", marginBottom:'0.4rem' }}>
                SELECTED TASKS
              </div>
              <div style={{ maxHeight:120, overflowY:'auto' }}>
                {selectedTasks.map(t => (
                  <div key={t.id} style={{ fontSize:'0.83rem', color:'#e8e8ea', padding:'0.2rem 0', borderBottom:'1px solid #2e2e33' }}>
                    <span style={{ fontSize:'0.72rem', color:'#8888a0', marginRight:'0.5rem', fontFamily:"'Space Mono',monospace" }}>
                      [{t.task_type}]
                    </span>
                    {t.title}
                  </div>
                ))}
              </div>
            </div>

            {/* Destinataire */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="form-group">
                <label>Recipient email *</label>
                <input
                  type="email" autoFocus
                  value={recipient} onChange={e => setRecipient(e.target.value)}
                  placeholder="contact@client.com"
                />
              </div>
              <div className="form-group">
                <label>Recipient name</label>
                <input
                  value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  placeholder="e.g. John Smith"
                />
              </div>
            </div>

            {/* Mode de génération */}
            <div className="form-group">
              <label>Generation mode</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                {[
                  { id:'template', label:'📋 Template',  desc:'Predefined templates' },
                  { id:'ai',       label:'⚡ AI',         desc:'AI service required' },
                  { id:'manual',   label:'✏️ Manual',     desc:'Write from scratch' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGenMode(m.id)}
                    style={{
                      flex:1, padding:'0.6rem 0.5rem', borderRadius:6, cursor:'pointer',
                      border: genMode === m.id ? '1px solid #e8652a' : '1px solid #2e2e33',
                      background: genMode === m.id ? 'rgba(232,101,42,0.1)' : '#18181b',
                      color: genMode === m.id ? '#e8652a' : '#8888a0',
                      fontSize:'0.82rem', textAlign:'center',
                    }}
                  >
                    <div style={{ fontWeight:500 }}>{m.label}</div>
                    <div style={{ fontSize:'0.7rem', marginTop:2 }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur de template email */}
            {genMode === 'template' && (
              <div className="form-group">
                <label>Email template</label>
                {emailTemplates.length === 0 ? (
                  <div className="alert alert-warn" style={{ fontSize:'0.82rem' }}>
                    No email templates found. Go to <strong>Templates</strong> to create some, or switch to AI/Manual mode.
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedTplId}
                      onChange={e => setSelectedTplId(e.target.value)}
                    >
                      {emailTemplates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.is_global ? '🌐 ' : '👤 '}{t.name}
                        </option>
                      ))}
                    </select>
                    {selectedTplId && (() => {
                      const tpl = emailTemplates.find(t => String(t.id) === selectedTplId)
                      return tpl?.description ? (
                        <p style={{ fontSize:'0.78rem', color:'#8888a0', marginTop:4 }}>{tpl.description}</p>
                      ) : null
                    })()}
                  </>
                )}
              </div>
            )}

            {genMode === 'ai' && (
              <div className="alert alert-info" style={{ fontSize:'0.82rem' }}>
                ⚡ The AI service (FastAPI) must be running on port 8000. First call downloads the model (~1.5 GB).
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={prepareDraft} disabled={loading}>
                {loading
                  ? <><span className="spinner" /> {genMode === 'ai' ? 'Generating…' : 'Preparing…'}</>
                  : 'Next → Review Draft'}
              </button>
            </div>
          </>
        )}

        {/* ════════════ STEP 2 — Révision ════════════ */}
        {step === 2 && (
          <>
            <div className="alert alert-warn" style={{ fontSize:'0.82rem', marginBottom:'1rem' }}>
              ⚠️ This email will be sent to <strong>{recipient}</strong> when you click "Send Email".
              You can still edit the content below.
            </div>

            <div className="form-group">
              <label>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            <div className="form-group">
              <label>
                Email body
                <span style={{ fontSize:'0.72rem', color:'#55555f', marginLeft:'0.5rem', fontFamily:"'Space Mono',monospace" }}>
                  editable
                </span>
              </label>
              <textarea
                rows={14}
                value={body}
                onChange={e => setBody(e.target.value)}
                style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.65, fontSize:'0.88rem' }}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" onClick={sendEmail} disabled={sending}>
                {sending
                  ? <><span className="spinner" /> Sending…</>
                  : '✉️ Send Email'}
              </button>
            </div>
          </>
        )}

        {/* ════════════ STEP 3 — Confirmé ════════════ */}
        {step === 3 && (
          <div style={{ textAlign:'center', padding:'2rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>✅</div>
            <h3 style={{ marginBottom:'0.5rem' }}>Email Sent</h3>
            <p style={{ marginBottom:'1.5rem' }}>
              Email sent to <strong>{recipient}</strong>.<br />
              Covered tasks have been marked as <em>requested</em>.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}

      </div>
    </div>
  )
}