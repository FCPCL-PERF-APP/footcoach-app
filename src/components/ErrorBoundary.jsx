import { Component } from 'react'
import { Sentry } from '../lib/sentry'
import { THEME } from '../theme'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })

    // Un chunk lazy-loadé (React.lazy) peut échouer à se charger si le navigateur a
    // encore en mémoire une page ouverte avant un déploiement plus récent : les noms
    // de fichiers changent à chaque build, et l'ancien chemin n'existe plus côté
    // serveur. C'est transitoire et se résout systématiquement par un rechargement —
    // on le fait automatiquement une fois (marqueur sessionStorage pour éviter une
    // boucle infinie si l'erreur persiste pour une autre raison).
    const isChunkLoadError = /dynamically imported module|Loading chunk|Importing a module script failed|not a valid JavaScript MIME type|Unexpected token '<'/i.test(error?.message || '')
    if (isChunkLoadError && !sessionStorage.getItem('fc-chunk-reload')) {
      sessionStorage.setItem('fc-chunk-reload', '1')
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, background: '#F9FAFB', textAlign: 'center'
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 16, background: '#fff', border: '1px solid #E5E7EB', padding: 5, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/icons/logo.jpg" alt="FC PCL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Oups, quelque chose s'est mal passé</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, maxWidth: 300 }}>
            L'application a rencontré une erreur inattendue. Essaie de recharger la page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            style={{
              padding: '12px 24px', borderRadius: 12, border: 'none',
              background: 'var(--gradient)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12
            }}>
            🔄 Retourner à l'accueil
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px', borderRadius: 12,
              border: '0.5px solid #D1D5DB', background: 'transparent',
              fontSize: 13, cursor: 'pointer', color: '#6B7280'
            }}>
            Recharger la page
          </button>
          {import.meta.env.DEV && (
            <details style={{ marginTop: 20, fontSize: 11, color: '#9CA3AF', textAlign: 'left', maxWidth: 400 }}>
              <summary>Détails de l'erreur</summary>
              <pre style={{ overflow: 'auto', padding: 8, background: '#F3F4F6', borderRadius: 8, marginTop: 8 }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
