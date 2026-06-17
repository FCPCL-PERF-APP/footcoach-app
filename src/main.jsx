import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { THEME } from './theme.js'

const style = document.createElement('style')
style.textContent = `
  :root {
    --bg-page: #F0F2F5;
    --bg-card: #ffffff;
    --bg-secondary: #F5F7FA;
    --text-primary: #111318;
    --text-secondary: #6B7280;
    --border: #E2E6ED;
    --nav-bg: #111318;
  }
  [data-theme="dark"] {
    --bg-page: #0F1117;
    --bg-card: #1A1D27;
    --bg-secondary: #232634;
    --text-primary: #F0F2F5;
    --text-secondary: #9CA3AF;
    --border: #2D3148;
    --nav-bg: #0A0C14;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-page);
    color: var(--text-primary);
    transition: background .3s, color .3s;
  }
  input, select, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { display: none; }
  ::selection { background: ${THEME.primary}; color: white; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
