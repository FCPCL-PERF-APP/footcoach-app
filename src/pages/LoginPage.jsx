import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'
import { CheckCircle2, Smartphone, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try { await signIn(email, password) }
    catch { setError('Email ou mot de passe incorrect.') }
    finally { setLoading(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    try { await resetPassword(email); setResetSent(true) }
    catch { setError('Erreur lors de l\'envoi.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gradient)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Logo animé */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%', margin: '0 auto 12px',
          border: '3px solid rgba(255,255,255,.3)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', padding: 7, boxSizing: 'border-box',
          animation: logoLoaded ? 'none' : 'pulse 1.5s infinite',
        }}>
          <img
            src="/icons/logo.jpg" alt="FC PCL"
            onLoad={() => setLogoLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: logoLoaded ? 1 : 0, transition: 'opacity .3s' }}
          />
        </div>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 2, letterSpacing: .5 }}>FC PCL</h1>
        <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>Plouagat · Châtelaudren · Lanrodec</p>
        <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,.4)', margin: '10px auto 0' }} />
      </div>

      {/* Carte connexion */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.black, marginBottom: 4 }}>
          {showReset ? 'Réinitialiser' : 'Connexion'}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          {showReset ? 'Entre ton email pour recevoir un lien' : 'Application de suivi — Équipe A'}
        </p>

        {!showReset ? (
          <form onSubmit={handleLogin}>
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" />
            <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
            <button type="button" onClick={() => setShowReset(true)} style={linkStyle}>
              Mot de passe oublié ?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            {resetSent ? (
              <div style={{ background: 'var(--success-bg)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Email envoyé !</p>
                <p style={{ fontSize: 12, color: 'var(--success)', marginBottom: 8 }}>Vérifie ta boîte mail (et les spams) — le lien est valable 24h.</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <Smartphone size={12} style={{ flexShrink: 0, marginTop: 2 }} /> Ouvre le lien depuis Safari sur ton iPhone pour créer ton nouveau mot de passe.
                </p>
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#FAEEDA', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>Email non reçu après 5 minutes ?</p>
                  <p style={{ fontSize: 11, color: 'var(--warning)' }}>Contacte ton coach directement — il peut te renvoyer un lien depuis l'app.</p>
                </div>
              </div>
            ) : (
              <>
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" />
                {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</p>}
                <button type="submit" disabled={loading} style={btnStyle}>
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </>
            )}
            <button type="button" onClick={() => { setShowReset(false); setResetSent(false); setError('') }} style={{ ...linkStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <ArrowLeft size={13} /> Retour à la connexion
            </button>
          </form>
        )}
      </div>

      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginTop: 20 }}>
        FC PCL · Application officielle · {new Date().getFullYear()}
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: .6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }} />
    </div>
  )
}

const btnStyle = {
  width: '100%', padding: 12,
  background: 'var(--gradient)',
  color: '#fff', border: 'none', borderRadius: 10,
  fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10
}

const linkStyle = {
  width: '100%', background: 'transparent', border: 'none',
  color: 'var(--primary)', fontSize: 13, cursor: 'pointer', padding: '4px 0',
  display: 'block', textAlign: 'center'
}
