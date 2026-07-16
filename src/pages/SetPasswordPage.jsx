import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { THEME } from '../theme'
import { CheckCircle2, AlertTriangle, Hourglass, Check } from 'lucide-react'

export default function SetPasswordPage() {
  const navigate = useNavigate()
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [linkError, setLinkError] = useState(null)

  useEffect(() => {
    // Un lien d'invitation/reset expiré ou déjà utilisé revient avec une erreur dans le
    // hash de l'URL (#error=access_denied&error_code=otp_expired&error_description=...)
    // plutôt qu'une session valide — sans ça, l'écran restait bloqué indéfiniment sur
    // "Vérification du lien..." sans aucun message.
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', '?'))
      const desc = params.get('error_description')
      setLinkError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Ce lien est invalide ou a expiré.')
      return
    }

    // Supabase gère automatiquement le token dans l'URL
    // On attend que la session soit établie
    let ready = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        ready = true
        setSessionReady(true)
      }
    })

    // Vérifie si une session existe déjà
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { ready = true; setSessionReady(true) }
    })

    // Filet de sécurité : si après 10s aucune session ni erreur explicite n'est
    // détectée, on affiche quand même un message plutôt que d'attendre indéfiniment.
    const timeout = setTimeout(() => {
      if (!ready) setLinkError('Ce lien ne fonctionne pas. Il est peut-être expiré ou déjà utilisé.')
    }, 10000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!pwd || !confirm) { setError('Remplis les deux champs.'); return }
    if (pwd.length < 6) { setError('Au moins 6 caractères.'); return }
    if (pwd !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setLoading(false)

    if (error) {
      setError('Erreur : ' + error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/'), 2500)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: THEME.gradient, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', background: '#fff', padding: 6, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <img src="/icons/logo.jpg" alt="FC PCL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>FC PCL</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>

        {success ? (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <CheckCircle2 size={44} color={THEME.success} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: THEME.success, marginBottom: 8 }}>Mot de passe créé !</p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>Tu vas être redirigé vers l'app...</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {sessionReady ? 'Crée ton mot de passe' : linkError ? 'Lien invalide' : 'Chargement...'}
            </h2>
            {!linkError && (
              <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
                Choisis un mot de passe pour accéder à l'app FC PCL
              </p>
            )}

            {linkError ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <AlertTriangle size={30} color={THEME.danger} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: THEME.danger, marginBottom: 6 }}>Ce lien ne fonctionne plus</p>
                <p style={{ fontSize: 12, color: '#6B7280' }}>{linkError}</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Demande au coach de te renvoyer une invitation.</p>
              </div>
            ) : !sessionReady ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Hourglass size={20} color="#9CA3AF" />
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Vérification du lien...</p>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                    Nouveau mot de passe
                  </label>
                  <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                    placeholder="Au moins 6 caractères" required
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                    Confirmer le mot de passe
                  </label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Répète le mot de passe" required
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }} />
                </div>
                {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 12 }}>{error}</p>}
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: 12,
                  background: THEME.gradient,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  {loading ? 'Enregistrement...' : <><Check size={14} /> Créer mon mot de passe</>}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
