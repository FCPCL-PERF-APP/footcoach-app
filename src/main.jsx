import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Styles globaux
const style = document.createElement('style')
style.textContent = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F4F6F9; color: #111; }
  input, select, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { display: none; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
