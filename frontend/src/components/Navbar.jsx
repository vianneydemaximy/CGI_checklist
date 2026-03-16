/**
 * components/Navbar.jsx — V2
 * Lien /templates rendu actif (route ajoutée dans App.jsx).
 */
import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const S = {
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 220,
    height: '100vh',

    background: '#ffffff',
    borderRight: '1px solid var(--border)',

    display: 'flex',
    flexDirection: 'column',

    padding: '1.5rem 0',
    zIndex: 100
  },
  logo: {
    padding: '0 1.25rem 1.5rem',
    borderBottom: '1px solid var(--border)', marginBottom: '1.5rem',
  },
  logoText: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  logoSub:  { fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: "'Space Mono', monospace", marginTop: 2 },
  link: (active) => ({
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.55rem 1.25rem', fontSize: '0.88rem',
    color:      active ? 'var(--accent)' : 'var(--text-dim)',
    background: active ? 'var(--accent-soft)' : 'transparent',
    textDecoration: 'none',
    borderRight: active ? '2px solid var(--accent)' : '2px solid transparent',
    transition: '0.15s ease', fontWeight: active ? 500 : 400,
  }),
  sectionLabel: {
    padding: '0.4rem 1.25rem', marginTop: '0.5rem',
    fontSize: '0.68rem', color: 'var(--text-dim)',
    fontFamily: "'Space Mono', monospace",
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  bottom: {
    marginTop: 'auto', padding: '1rem 1.25rem',
    borderTop: '1px solid #2e2e33',
  },
  userName: {
    fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500,
    display: 'block', marginBottom: 4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  roleBadge: {
    display: 'inline-block', padding: '0.15rem 0.45rem',
    background: 'var(--bg-hover)', borderRadius: 4,
    fontSize: '0.7rem', fontFamily: "'Space Mono', monospace", color: '#d6062b',
    marginBottom: 8,
  },
}

function NavItem({ to, icon, label, end = false }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => S.link(isActive)}>
      <span>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <nav style={S.sidebar}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
        <div >
          <img src="../assets/cgi-logo.png" alt="CGI" style={{ height: 60}} />
        </div>
        <div style={S.logoSub}>Augmented Checklist </div>
      </div>

      <div style={S.sectionLabel}>Workspace</div>
      <NavItem to="/"          end  icon="▦" label="Dashboard"  />
      <NavItem to="/templates"      icon="◫" label="Templates"  />

      <div style={S.bottom}>
        <span style={S.userName}>{user?.name}</span>
        <span style={S.roleBadge}>{user?.role}</span>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}