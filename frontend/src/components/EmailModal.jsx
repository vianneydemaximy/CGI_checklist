/**
 * components/EmailModal.jsx — V3
 *
 * Changements :
 *  - Mode IA supprimé (bouton et logique retirés)
 *  - Sélecteur de langue qui filtre les templates email
 *  - Mode "Template" (défaut) et "Manuel"
 */
import React, { useState, useEffect } from 'react'
import api from '../services/api'

const LANG_LABELS = { en: '🇬🇧 English', fr: '🇫🇷 Français' }

function applyPlaceholders(text, { recipientName, taskList, consultantName }) {
  return text
    .replace(/\{\{recipient_name\}\}/g,  recipientName  || 'Client')
    .replace(/\{\{task_list\}\}/g,        taskList       || '')
    .replace(/\{\{consultant_name\}\}/g,  consultantName || '[Your Name]')
    .replace(/\{\{deadline\}\}/g,         '[DATE TO FILL IN]')
    .replace(/\{\{deadline\}\}/g,         '[DATE À COMPLÉTER]')
}

function formatTaskList(tasks) {
  return tasks.map((t, i) => `  ${i + 1}. [${t.task_type}] ${t.title}`).join('\n')
}

export default function EmailModal({ projectId, selectedTasks, onClose, onSent, consultantName, projectLanguage = 'en' }) {
  const [step, setStep] = useState(1)

  /* Config */
  const [recipient,     setRecipient]     = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [language,      setLanguage]      = useState(projectLanguage)
  const [genMode,       setGenMode]       = useState('template')   // 'template' | 'manual'
  const [emailTemplates,setEmailTemplates]= useState([])
  const [selectedTplId, setSelectedTplId] = useState('')

  /* Brouillon */
  const [draftId, setDraftId] = useState(null)
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')

  /* UI */
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [sending, setSending] = useState(false)

  /* Charger les templates email filtrés par langue */
  useEffect(() => {
    api.get('/email-templates')
      .then(r => {
        setEmailTemplates(r.data)
        // Sélectionner automatiquement le premier template dans la langue du projet
        const inLang = r.data.filter(t => t.language === language)
        if (inLang.length > 0) setSelectedTplId(String(inLang[0].id))
        else if (r.data.length > 0) setSelectedTplId(String(r.data[0].id))
      })
      .catch(() => setGenMode('manual'))
  }, [])

  /* Filtrer les templates selon la langue sélectionnée */
  const filteredTemplates = emailTemplates.filter(t => t.language === language)

  /* Quand la langue change, resélectionner le premier template disponible */
  useEffect(() => {
    const inLang = emailTemplates.filter(t => t.language === language)
    if (inLang.length > 0) setSelectedTplId(String(inLang[0].id))
    else setSelectedTplId('')
  }, [language, emailTemplates])

  async function prepareDraft() {
    if (!recipient) { setError('Recipient email is required'); return }
    setError(''); setLoading(true)

    try {
      const taskList = formatTaskList(selectedTasks)

      if (genMode === 'template' && selectedTplId) {
        const tpl = emailTemplates.find(t => String(t.id) === selectedTplId)
        if (!tpl) throw new Error('Template not found')

        const finalSubj = applyPlaceholders(tpl.subject, { recipientName, taskList, consultantName })
        const finalBody = applyPlaceholders(tpl.body,    { recipientName, taskList, consultantName })

        const res = await api.post(`/projects/${projectId}/emails/draft`, {
          recipient_email: recipient,
          subject:         finalSubj,
          body:            finalBody,
          task_ids:        selectedTasks.map(t => t.id),
        })
        setDraftId(res.data.id)
        setSubject(finalSubj)
        setBody(finalBody)

      } else {
        /* Mode manuel — brouillon vide */
        const initBody = language === 'fr'
          ? `Bonjour ${recipientName || 'Madame, Monsieur'},\n\nVeuillez trouver ci-dessous les éléments à nous transmettre :\n\n${taskList}\n\nCordialement,\n${consultantName || '[Votre Nom]'}`
          : `Dear ${recipientName || 'Client'},\n\nPlease provide the following items:\n\n${taskList}\n\nBest regards,\n${consultantName || '[Your Name]'}`

        const initSubj = language === 'fr'
          ? '[Préparation Mission CGI] Demande de documents'
          : '[CGI Mission Preparation] Document Request'

        const res = await api.post(`/projects/${projectId}/emails/draft`, {
          recipient_email: recipient,
          subject:         initSubj,
          body:            initBody,
          task_ids:        selectedTasks.map(t => t.id),
        })
        setDraftId(res.data.id)
        setSubject(initSubj)
        setBody(initBody)
      }

      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendEmail() {
    const confirmMsg = language === 'fr'
      ? `Envoyer cet email à ${recipient} ? Cette action est irréversible.`
      : `Send this email to ${recipient}? This cannot be undone.`
    if (!window.confirm(confirmMsg)) return

    setSending(true); setError('')
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

  const labels = {
    title:        language === 'fr' ? 'Générateur d\'email' : 'Email Generator',
    stepLabels:   language === 'fr' ? ['Configurer', 'Réviser', 'Envoyé'] : ['Configure', 'Review & Edit', 'Sent'],
    recipient:    language === 'fr' ? 'Email destinataire *' : 'Recipient email *',
    recipientName:language === 'fr' ? 'Nom du destinataire' : 'Recipient name',
    mode:         language === 'fr' ? 'Mode de rédaction' : 'Draft mode',
    template:     language === 'fr' ? '📋 Template' : '📋 Template',
    manual:       language === 'fr' ? '✏️ Manuel' : '✏️ Manual',
    emailTpl:     language === 'fr' ? 'Template email' : 'Email template',
    next:         language === 'fr' ? 'Suivant → Réviser' : 'Next → Review Draft',
    send:         language === 'fr' ? '✉️ Envoyer' : '✉️ Send Email',
    back:         language === 'fr' ? '← Retour' : '← Back',
    noTemplate:   language === 'fr' ? 'Aucun template disponible en français. Créez-en un dans Templates.' : 'No templates in this language. Create one in Templates.',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div className="modal-header">
          <div>
            <h2>{labels.title}</h2>
            <p style={{ fontSize:'0.8rem', marginTop:2 }}>
              {step === 1 && `${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} selected`}
              {step === 2 && (language === 'fr' ? 'Vérifiez et modifiez avant envoi' : 'Review and edit before sending')}
              {step === 3 && (language === 'fr' ? 'Email envoyé' : 'Email sent')}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Indicateur d'étapes */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
          {labels.stepLabels.map((label, i) => (
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

        {/* ══ STEP 1 — Configuration ══ */}
        {step === 1 && (
          <>
            {/* Récap tâches */}
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ fontSize:'0.73rem', color:'#55555f', fontFamily:"'Space Mono',monospace", marginBottom:'0.4rem' }}>
                {language === 'fr' ? 'TÂCHES SÉLECTIONNÉES' : 'SELECTED TASKS'}
              </div>
              <div style={{ maxHeight:100, overflowY:'auto' }}>
                {selectedTasks.map(t => (
                  <div key={t.id} style={{ fontSize:'0.83rem', color:'#e8e8ea', padding:'0.2rem 0', borderBottom:'1px solid #2e2e33' }}>
                    <span style={{ fontSize:'0.72rem', color:'#8888a0', marginRight:'0.5rem', fontFamily:"'Space Mono',monospace" }}>
                      [{t.task_type}]
                    </span>{t.title}
                  </div>
                ))}
              </div>
            </div>

            {/* Langue + destinataire */}
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:'1rem', alignItems:'end' }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>{language === 'fr' ? 'Langue' : 'Language'}</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ minWidth:130 }}>
                  {Object.entries(LANG_LABELS).map(([k, v]) =>
                    <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>{labels.recipient}</label>
                <input type="email" autoFocus value={recipient} onChange={e => setRecipient(e.target.value)}
                  placeholder="contact@client.com" />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>{labels.recipientName}</label>
                <input value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  placeholder={language === 'fr' ? 'ex. Jean Martin' : 'e.g. John Smith'} />
              </div>
            </div>

            {/* Mode de génération (sans IA) */}
            <div className="form-group" style={{ marginTop:'1rem' }}>
              <label>{labels.mode}</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                {[
                  { id:'template', label:labels.template, desc: language === 'fr' ? 'Templates prédéfinis' : 'Predefined templates' },
                  { id:'manual',   label:labels.manual,   desc: language === 'fr' ? 'Saisie libre'         : 'Write from scratch' },
                ].map(m => (
                  <button key={m.id} type="button" onClick={() => setGenMode(m.id)} style={{
                    flex:1, padding:'0.6rem 0.5rem', borderRadius:6, cursor:'pointer',
                    border:      genMode === m.id ? '1px solid #e8652a' : '1px solid #2e2e33',
                    background:  genMode === m.id ? 'rgba(232,101,42,0.1)' : '#18181b',
                    color:       genMode === m.id ? '#e8652a' : '#8888a0',
                    fontSize:'0.82rem', textAlign:'center',
                  }}>
                    <div style={{ fontWeight:500 }}>{m.label}</div>
                    <div style={{ fontSize:'0.7rem', marginTop:2 }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur de template email */}
            {genMode === 'template' && (
              <div className="form-group">
                <label>{labels.emailTpl}</label>
                {filteredTemplates.length === 0 ? (
                  <div className="alert alert-warn" style={{ fontSize:'0.82rem' }}>
                    {labels.noTemplate}
                  </div>
                ) : (
                  <>
                    <select value={selectedTplId} onChange={e => setSelectedTplId(e.target.value)}>
                      {filteredTemplates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.is_global ? '🌐 ' : '👤 '}{t.name}
                        </option>
                      ))}
                    </select>
                    {selectedTplId && (() => {
                      const tpl = emailTemplates.find(t => String(t.id) === selectedTplId)
                      return tpl?.description
                        ? <p style={{ fontSize:'0.78rem', color:'#8888a0', marginTop:4 }}>{tpl.description}</p>
                        : null
                    })()}
                  </>
                )}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button className="btn btn-primary" onClick={prepareDraft} disabled={loading}>
                {loading
                  ? <><span className="spinner" /> {language === 'fr' ? 'Préparation…' : 'Preparing…'}</>
                  : labels.next}
              </button>
            </div>
          </>
        )}

        {/* ══ STEP 2 — Révision ══ */}
        {step === 2 && (
          <>
            <div className="alert alert-warn" style={{ fontSize:'0.82rem', marginBottom:'1rem' }}>
              {language === 'fr'
                ? `⚠️ Cet email sera envoyé à ${recipient} lorsque vous cliquerez sur "Envoyer". Vous pouvez encore modifier le contenu.`
                : `⚠️ This email will be sent to ${recipient} when you click "Send". You can still edit below.`}
            </div>
            <div className="form-group">
              <label>{language === 'fr' ? 'Objet' : 'Subject'}</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="form-group">
              <label>
                {language === 'fr' ? 'Corps du message' : 'Email body'}
                <span style={{ fontSize:'0.72rem', color:'#55555f', marginLeft:'0.5rem', fontFamily:"'Space Mono',monospace" }}>
                  {language === 'fr' ? 'modifiable' : 'editable'}
                </span>
              </label>
              <textarea rows={14} value={body} onChange={e => setBody(e.target.value)}
                style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.65, fontSize:'0.88rem' }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>{labels.back}</button>
              <button className="btn btn-primary" onClick={sendEmail} disabled={sending}>
                {sending ? <><span className="spinner" /> {language === 'fr' ? 'Envoi…' : 'Sending…'}</> : labels.send}
              </button>
            </div>
          </>
        )}

        {/* ══ STEP 3 — Confirmé ══ */}
        {step === 3 && (
          <div style={{ textAlign:'center', padding:'2rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>✅</div>
            <h3 style={{ marginBottom:'0.5rem' }}>
              {language === 'fr' ? 'Email envoyé' : 'Email Sent'}
            </h3>
            <p style={{ marginBottom:'1.5rem' }}>
              {language === 'fr'
                ? `Email envoyé à ${recipient}. Les tâches couvertes ont été marquées comme "demandées".`
                : `Email sent to ${recipient}. Covered tasks marked as "requested".`}
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              {language === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}