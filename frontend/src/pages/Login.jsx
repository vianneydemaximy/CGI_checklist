/**
 * pages/Login.jsx
 * Authentication page — dark industrial design.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }   = useAuth()
  const navigate    = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f0f10', padding: '1rem',
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(#e8652a 1px, transparent 1px), linear-gradient(90deg, #e8652a 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, background: '#e8652a',
            borderRadius: 14, fontSize: '1.8rem', marginBottom: '1rem',
          }}>⬡</div>
          <h1 style={{ fontSize: '1.5rem', color: '#e8e8ea', marginBottom: '0.25rem' }}>
            Document Orchestrator
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#8888a0', fontFamily: "'Space Mono', monospace" }}>
            CGI Internal — Consultant Access
          </p>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Sign in to your account</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email" type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@cgi.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password" type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" style={{ marginRight: '0.5rem' }} /> Signing in…</>
                : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Dev hint */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#3a3a40' }}>
          Default: admin@cgi.com / Admin123!
        </p>
      </div>
    </div>
  )
}