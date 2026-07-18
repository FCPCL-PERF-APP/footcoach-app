import { useState } from 'react'
import { usePush } from '../hooks/usePush'
import { useAuth } from '../hooks/useAuth'

export default function PushToggle() {
  const { profile } = useAuth()
  const userId = profile?.auth_id || profile?.id
  const { pushSupported, pushEnabled, enablePush, disablePush } = usePush(userId)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  if (!pushSupported) return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
      📵 Les notifications push ne sont pas supportées sur ce navigateur. Installe l'app depuis Safari sur iPhone.
    </div>
  )

  async function toggle() {
    setLoading(true)
    setMsg(null)
    if (pushEnabled) {
      await disablePush()
      setMsg({ ok: false, text: '🔕 Notifications désactivées.' })
    } else {
      const success = await enablePush()
      if (success) setMsg({ ok: true, text: '🔔 Notifications activées ! Tu recevras les convocations et rappels.' })
      else setMsg({ ok: false, text: '❌ Impossible d\'activer. Vérifie les autorisations dans les réglages.' })
    }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>🔔 Notifications push</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {pushEnabled ? 'Activées — convocations, rappels RPE' : 'Désactivées'}
          </p>
        </div>
        <button onClick={toggle} disabled={loading} style={{
          padding: '7px 14px', borderRadius: 20, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: pushEnabled ? '#EAF3DE' : 'var(--primary-bg)',
          color: pushEnabled ? '#3B6D11' : 'var(--primary)',
          fontSize: 12, fontWeight: 600
        }}>
          {loading ? '...' : pushEnabled ? '✅ Activées' : 'Activer'}
        </button>
      </div>
      {msg && (
        <p style={{ fontSize: 11, color: msg.ok ? '#3B6D11' : '#A32D2D', marginTop: 4 }}>{msg.text}</p>
      )}
    </div>
  )
}
