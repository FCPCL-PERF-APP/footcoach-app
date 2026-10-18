import { useEffect, useState } from 'react'
import { AlertTriangle, WifiOff, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { flushQueue, getQueueCount, getFailedItems, retryFailed, discardFailed } from '../lib/offlineQueue'

const NOMS = {
  rpe: 'RPE', footbar: 'Footbar', presences: 'Présence', convocations: 'Convocations',
  stats_match: 'Stats joueur', stats_collectives: 'Stats collectives', rapports_match: 'Rapport de match',
}

// Bandeau global (toutes les pages) : prévient quand des saisies attendent d'être envoyées
// (hors-ligne) ou, surtout, quand le serveur en a REFUSÉ — jusqu'ici elles disparaissaient
// sans qu'on le sache. Relance aussi l'envoi des éléments en attente dès l'ouverture de
// l'appli et au retour du réseau, sans devoir rouvrir la page concernée.
export default function SyncStatusBanner() {
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function refresh() {
    setPending(getQueueCount())
    setFailed(getFailedItems())
  }

  useEffect(() => {
    refresh()
    flushQueue().then(refresh)
    window.addEventListener('fc-offline-queue-changed', refresh)
    window.addEventListener('online', refresh)
    function onVisible() { if (document.visibilityState === 'visible') flushQueue().then(refresh) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('fc-offline-queue-changed', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!pending && !failed.length) return null

  async function relancer() {
    setBusy(true)
    await retryFailed()
    await flushQueue()
    setBusy(false)
    refresh()
  }

  const bouton = { border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }

  return (
    <div style={{ margin: '8px 12px 0' }}>
      {failed.length > 0 && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{failed.length} saisie(s) refusée(s) par le serveur — non enregistrée(s)</span>
            <button onClick={() => setOpen(o => !o)} style={{ ...bouton, background: 'transparent', color: 'inherit', padding: 2 }}>
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {open && (
            <div style={{ marginTop: 6 }}>
              {failed.map(f => (
                <div key={f.id} style={{ fontSize: 11, padding: '4px 0', borderTop: '0.5px solid rgba(0,0,0,.1)' }}>
                  <b>{NOMS[f.table] || f.table || 'Saisie'}</b> · {new Date(f.queuedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  <div style={{ opacity: .85, wordBreak: 'break-word' }}>{f.error}</div>
                </div>
              ))}
              <p style={{ fontSize: 10, margin: '6px 0', opacity: .85 }}>Fais une capture de ce message et envoie-la au coach.</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={relancer} disabled={busy} style={{ ...bouton, background: 'var(--danger)', color: '#fff' }}><RefreshCw size={12} /> {busy ? '...' : 'Réessayer'}</button>
                <button onClick={() => { if (window.confirm('Abandonner ces saisies définitivement ?')) { discardFailed(); refresh() } }} style={{ ...bouton, background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}>Ignorer</button>
              </div>
            </div>
          )}
        </div>
      )}
      {pending > 0 && (
        <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <WifiOff size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{pending} saisie(s) en attente d'envoi (réseau)</span>
          <button onClick={relancer} disabled={busy} style={{ ...bouton, background: 'var(--warning)', color: '#fff' }}><RefreshCw size={12} /> {busy ? '...' : 'Envoyer'}</button>
        </div>
      )}
    </div>
  )
}
