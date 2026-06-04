import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
    } catch (err) {
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
    } catch (err) {
      setError('Erreur lors de l\'envoi. Vérifie ton email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <span style={{ fontSize: 32 }}>⚽</span>
        </div>
        <h1 style={styles.title}>FootCoach App</h1>
        <p style={styles.subtitle}>
          {import.meta.env.VITE_TEAM_NAME || 'Application de suivi d\'équipe'}
        </p>

        {!showReset ? (
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={styles.input}
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} style={styles.btnPrimary}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              style={styles.linkBtn}
            >
              Mot de passe oublié ?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} style={styles.form}>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
              Entre ton email pour recevoir un lien de réinitialisation.
            </p>
            {resetSent ? (
              <div style={styles.successBox}>
                ✅ Email envoyé ! Vérifie ta boîte mail.
              </div>
            ) : (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ton@email.com"
                    required
                    style={styles.input}
                  />
                </div>
                {error && <p style={styles.error}>{error}</p>}
                <button type="submit" disabled={loading} style={styles.btnPrimary}>
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { setShowReset(false); setResetSent(false); setError('') }}
              style={styles.linkBtn}
            >
              ← Retour à la connexion
            </button>
          </form>
        )}
      </div>

      <p style={styles.footer}>
        © {new Date().getFullYear()} FootCoach App
      </p>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: '#F4F6F9'
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '28px 24px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center'
  },
  logo: {
    width: 64, height: 64,
    background: '#185FA5',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px'
  },
  title: { fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 24 },
  form: { textAlign: 'left' },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, fontWeight: 500 },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1px solid #ddd', borderRadius: 10,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    background: '#FAFAFA'
  },
  error: { color: '#c0392b', fontSize: 12, marginBottom: 10 },
  btnPrimary: {
    width: '100%', padding: '12px',
    background: '#185FA5', color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    marginBottom: 10
  },
  linkBtn: {
    width: '100%', background: 'transparent', border: 'none',
    color: '#185FA5', fontSize: 13, cursor: 'pointer', padding: '4px 0'
  },
  successBox: {
    background: '#EAF3DE', color: '#3B6D11',
    borderRadius: 10, padding: '12px 14px',
    fontSize: 13, marginBottom: 12
  },
  footer: { marginTop: 24, fontSize: 11, color: '#aaa' }
}
