import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
    } catch {
      setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch {
      setError('Erreur lors de l\'envoi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.gradient,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      {/* Logo + nom club */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <img src="/icons/logo.jpg" alt="FC PCL"
          style={{ width: 90, height: 90, borderRadius: '50%', border: '3px solid rgba(255,255,255,.3)', marginBottom: 12, objectFit: 'cover' }} />
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 2, letterSpacing: .5 }}>FC PCL</h1>
        <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>Plouagat · Châtelaudren · Lanrodec</p>
        <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,.4)', margin: '10px auto 0' }} />
      </div>

      {/* Carte connexion */}
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '28px 24px', width: '100%', maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,.25)'
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.black, marginBottom: 4 }}>
          {showReset ? 'Réinitialiser' : 'Connexion'}
        </h2>
        <p style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 20 }}>
          {showReset ? 'Entre ton email pour recevoir un lien' : 'Application de suivi — Équipe A'}
        </p>

        {!showReset ? (
          <form onSubmit={handleLogin}>
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" />
            <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 10 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle(THEME)}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
            <button type="button" onClick={() => setShowReset(true)} style={linkStyle}>
              Mot de passe oublié ?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            {resetSent ? (
              <div style={{ background: '#EAF3DE', borderRadius: 10, padding: 12, fontSize: 13, color: THEME.success, marginBottom: 12 }}>
                ✅ Email envoyé ! Vérifie ta boîte mail.
              </div>
            ) : (
              <>
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" />
                {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 10 }}>{error}</p>}
                <button type="submit" disabled={loading} style={btnStyle(THEME)}>
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </>
            )}
            <button type="button" onClick={() => { setShowReset(false); setResetSent(false); setError('') }} style={linkStyle}>
              ← Retour à la connexion
            </button>
          </form>
        )}
      </div>

      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginTop: 20 }}>
        FC PCL · Application officielle · {new Date().getFullYear()}
      </p>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }} />
    </div>
  )
}

function btnStyle(THEME) {
  return {
    width: '100%', padding: 12,
    background: THEME.gradient, color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    marginBottom: 10
  }
}

const linkStyle = {
  width: '100%', background: 'transparent', border: 'none',
  color: '#185FA5', fontSize: 13, cursor: 'pointer', padding: '4px 0',
  display: 'block', textAlign: 'center'
}
