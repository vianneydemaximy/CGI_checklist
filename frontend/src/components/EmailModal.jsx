/**
 * components/EmailModal.jsx
 * Step 1: Generate draft via AI.
 * Step 2: Review/edit draft.
 * Step 3: Confirm and send.
 *
 * Human validation is enforced — the user must explicitly click "Send".
 */
import React, { useState } from 'react'
import api from '../services/api'

export default function EmailModal({ projectId, selectedTasks, onClose, onSent }) {
  const [step, setStep]         = useState(1)   // 1=config, 2=review, 3=done
  const [recipient, setRecipient]   = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [draftId, setDraftId]   = useState(null)
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState('')

  async function generateDraft() {
    if (!recipient) { setError('Recipient email is required'); return }
    setError(''); setGenerating(true)
    try {
      const res = await api.post(`/projects/${projectId}/emails/generate`, {
        task_ids: selectedTasks.map(t => t.id),
        recipient_email: recipient,
        recipient_name: recipientName || 'Client',
      })
      setDraftId(res.data.id)
      setSubject(res.data.subject)
      setBody(res.data.body)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function sendEmail() {
    if (!window.confirm('Are you sure you want to send this email? This action cannot be undone.')) return
    setSending(true); setError('')
    try {
      await api.post(`/emails/${draftId}/send`, { subject, body })
      setStep(3)
      onSent?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Email Generator</h2>
            <p style={{ fontSize:'0.8rem', marginTop:2 }}>
              {step === 1 && `${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} selected`}
              {step === 2 && 'Review and edit the draft before sending'}
              {step === 3 && 'Email sent successfully'}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
          {['Configure', 'Review Draft', 'Sent'].map((label, i) => (
            <div key={i} style={{ flex:1, textAlign:'center', fontSize:'0.75rem', padding:'0.35rem',
              borderRadius:4, fontFamily:"'Space Mono',monospace",
              background: step === i+1 ? '#e8652a' : step > i+1 ? '#064e35' : '#222',
              color: step === i+1 ? '#fff' : step > i+1 ? '#34d399' : '#55555f',
            }}>
              {step > i+1 ? '✓ ' : `${i+1}. `}{label}
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Step 1 — Configure */}
        {step === 1 && (
          <>
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ fontSize:'0.78rem', color:'#55555f', fontFamily:"'Space Mono',monospace", marginBottom:'0.5rem' }}>SELECTED TASKS</div>
              {selectedTasks.map(t => (
                <div key={t.id} style={{ fontSize:'0.85rem', color:'#e8e8ea', padding:'0.3rem 0', borderBottom:'1px solid #2e2e33' }}>
                  {t.title}
                </div>
              ))}
            </div>
            <div className="form-group">
              <label>Recipient email *</label>
              <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="contact@clientcompany.com" autoFocus />
            </div>
            <div className="form-group">
              <label>Recipient name (used in salutation)</label>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div className="alert alert-info" style={{ fontSize:'0.82rem' }}>
              🤖 The AI will generate a professional draft. You will review and edit it before any email is sent.
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={generateDraft} disabled={generating}>
                {generating ? <><span className="spinner" /> Generating draft…</> : '⚡ Generate Draft'}
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Review */}
        {step === 2 && (
          <>
            <div className="alert alert-warn" style={{ fontSize:'0.82rem', marginBottom:'1rem' }}>
              ⚠️ Review carefully. This email will be sent to <strong>{recipient}</strong> when you click "Send Email".
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email body (editable)</label>
              <textarea
                rows={12} value={body} onChange={e => setBody(e.target.value)}
                style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" onClick={sendEmail} disabled={sending}>
                {sending ? <><span className="spinner" /> Sending…</> : '✉️ Send Email'}
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div style={{ textAlign:'center', padding:'2rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>✅</div>
            <h3 style={{ marginBottom:'0.5rem' }}>Email Sent</h3>
            <p style={{ marginBottom:'1.5rem' }}>Your email to {recipient} has been sent. Tasks have been marked as "requested".</p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}