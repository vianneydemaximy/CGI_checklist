/**
 * components/Navbar.jsx — V2
 * Lien /templates rendu actif (route ajoutée dans App.jsx).
 */
import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const S = {
  sidebar: {
    width: 220, minHeight: '100vh',
    background: '#111113', borderRight: '1px solid #2e2e33',
    display: 'flex', flexDirection: 'column',
    padding: '1.5rem 0', flexShrink: 0,
  },
  logo: {
    padding: '0 1.25rem 1.5rem',
    borderBottom: '1px solid #2e2e33', marginBottom: '1.5rem',
  },
  logoText: { fontSize: '0.95rem', fontWeight: 700, color: '#e8e8ea', letterSpacing: '-0.01em' },
  logoSub:  { fontSize: '0.7rem', color: '#8888a0', fontFamily: "'Space Mono', monospace", marginTop: 2 },
  link: (active) => ({
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.55rem 1.25rem', fontSize: '0.88rem',
    color:      active ? '#e8652a' : '#8888a0',
    background: active ? 'rgba(232,101,42,0.1)' : 'transparent',
    textDecoration: 'none',
    borderRight: active ? '2px solid #e8652a' : '2px solid transparent',
    transition: '0.15s ease', fontWeight: active ? 500 : 400,
  }),
  sectionLabel: {
    padding: '0.4rem 1.25rem', marginTop: '0.5rem',
    fontSize: '0.68rem', color: '#55555f',
    fontFamily: "'Space Mono', monospace",
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  bottom: {
    marginTop: 'auto', padding: '1rem 1.25rem',
    borderTop: '1px solid #2e2e33',
  },
  userName: {
    fontSize: '0.82rem', color: '#e8e8ea', fontWeight: 500,
    display: 'block', marginBottom: 4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  roleBadge: {
    display: 'inline-block', padding: '0.15rem 0.45rem',
    background: '#222', borderRadius: 4,
    fontSize: '0.7rem', fontFamily: "'Space Mono', monospace", color: '#e8652a',
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
      <div style={S.logo}>
        <div style={S.logoText}>⬡ CGI Orchestrator</div>
        <div style={S.logoSub}>Document Management</div>
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