// Export PDF de la composition (visuel terrain + liste + remplaçants), pensé pour être
// intégré dans une présentation : page A4 paysage, terrain à gauche, liste à droite.
// Même principe que exportRapportPDF (fenêtre d'impression → "Enregistrer en PDF").
// Les couleurs sont écrites en dur : les variables CSS de l'appli n'existent pas dans la
// fenêtre ouverte.
const BLEU = '#1A3A6B'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function exportCompoPDF({ event, formation, compo, banc, joueurs, capitaineId }) {
  const win = window.open('', '_blank')
  if (!win) { alert('Autorise les popups pour exporter le PDF.'); return }

  const byId = Object.fromEntries((joueurs || []).map(j => [j.id, j]))
  const dateStr = event?.date_heure
    ? new Date(event.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const defs = []
  const players = []
  formation.positions.forEach((pos, i) => {
    const j = byId[compo[pos.id]]
    const cy = pos.y * 1.5
    if (!j) {
      players.push(`<circle cx="${pos.x}" cy="${cy}" r="8.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.6)" stroke-width=".5"/>
        <text x="${pos.x}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" font-size="4" fill="rgba(255,255,255,.7)">${esc(pos.label)}</text>`)
      return
    }
    const num = j.numero || (i + 1)
    if (j.photo_url) {
      defs.push(`<clipPath id="c${i}"><circle cx="${pos.x}" cy="${cy}" r="8.5"/></clipPath>`)
      players.push(`<circle cx="${pos.x}" cy="${cy}" r="9" fill="#fff"/>
        <image href="${esc(j.photo_url)}" x="${pos.x - 8.5}" y="${cy - 8.5}" width="17" height="17" clip-path="url(#c${i})" preserveAspectRatio="xMidYMid slice"/>
        <circle cx="${pos.x}" cy="${cy}" r="8.5" fill="none" stroke="${BLEU}" stroke-width=".7"/>`)
    } else {
      players.push(`<circle cx="${pos.x}" cy="${cy}" r="8.5" fill="${BLEU}" stroke="rgba(255,255,255,.7)" stroke-width=".5"/>
        <text x="${pos.x}" y="${cy + 1.2}" text-anchor="middle" dominant-baseline="middle" font-size="4.5" fill="#fff" font-weight="700">${esc(num)}</text>`)
    }
    players.push(`<circle cx="${pos.x + 6.5}" cy="${cy + 6.5}" r="3.2" fill="${BLEU}" stroke="#fff" stroke-width=".5"/>
      <text x="${pos.x + 6.5}" y="${cy + 7.4}" text-anchor="middle" dominant-baseline="middle" font-size="3" fill="#fff" font-weight="700">${esc(num)}</text>
      <rect x="${pos.x - 9.5}" y="${cy + 10.5}" width="19" height="5.2" rx="1.2" fill="rgba(0,0,0,.6)"/>
      <text x="${pos.x}" y="${cy + 14.2}" text-anchor="middle" font-size="3.2" fill="#fff" font-weight="600">${esc(j.nom?.slice(0, 7))}</text>`)
    if (j.id === capitaineId) {
      players.push(`<circle cx="${pos.x - 6.5}" cy="${cy - 6.5}" r="3.4" fill="#FACC15" stroke="#fff" stroke-width=".5"/>
        <text x="${pos.x - 6.5}" y="${cy - 5.6}" text-anchor="middle" dominant-baseline="middle" font-size="3.4" fill="#111" font-weight="800">C</text>`)
    }
  })

  const svg = `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" style="height:100%;width:auto;display:block">
    <defs>${defs.join('')}</defs>
    <rect width="100" height="150" fill="#2d7a27"/>
    ${[0,1,2,3,4,5,6,7,8,9].map(i => i % 2 === 0 ? `<rect x="0" y="${i * 15}" width="100" height="15" fill="rgba(255,255,255,.04)"/>` : '').join('')}
    <rect x="5" y="3" width="90" height="144" fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".5" rx="1"/>
    <line x1="5" y1="75" x2="95" y2="75" stroke="rgba(255,255,255,.4)" stroke-width=".4"/>
    <circle cx="50" cy="75" r="14" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".4"/>
    <rect x="25" y="3" width="50" height="26" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".4"/>
    <rect x="37" y="3" width="26" height="12" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".4"/>
    <rect x="25" y="121" width="50" height="26" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".4"/>
    <rect x="37" y="135" width="26" height="12" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".4"/>
    ${players.join('')}
  </svg>`

  const nomComplet = j => `${j.prenom ? j.prenom + ' ' : ''}${j.nom}`
  const titulaires = formation.positions.map(pos => {
    const j = byId[compo[pos.id]]
    return j ? `<tr><td class="pos">${esc(pos.label)}</td><td>${esc(nomComplet(j))}${j.id === capitaineId ? ' <b class="cap">C</b>' : ''}</td><td class="num">${j.numero ? esc(j.numero) : ''}</td></tr>` : ''
  }).join('')
  const remplacants = (banc || []).map(id => byId[id]).filter(Boolean)
    .map(j => `<tr><td>${esc(nomComplet(j))}</td><td class="num">${j.numero ? esc(j.numero) : ''}</td></tr>`).join('')
  const capitaine = byId[capitaineId]

  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
  <title>Composition — ${esc(event?.titre || 'Match')}</title>
  <style>
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;color:#111;height:190mm;display:flex;flex-direction:column}
    .header{display:flex;align-items:center;gap:12px;border-bottom:3px solid ${BLEU};padding-bottom:8px;margin-bottom:10px}
    .header img{width:48px;height:48px;object-fit:contain}
    h1{font-size:20px;color:${BLEU}}
    .sub{font-size:12px;color:#555;margin-top:2px}
    .main{display:flex;gap:20px;flex:1;min-height:0}
    .pitch{height:100%;border-radius:10px;overflow:hidden;flex-shrink:0}
    .side{flex:1;min-width:0}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${BLEU};border-bottom:1px solid ${BLEU};padding-bottom:3px;margin:10px 0 6px}
    h2:first-child{margin-top:0}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:3px 4px;border-bottom:1px solid #e5e5e5}
    td.pos{width:48px;color:#666;font-size:11px}
    td.num{width:34px;text-align:right;color:#666}
    .cap{display:inline-block;background:#FACC15;color:#111;border-radius:50%;width:16px;height:16px;line-height:16px;text-align:center;font-size:10px}
    .footer{margin-top:8px;font-size:10px;color:#999;text-align:center}
  </style></head><body>
  <div class="header">
    <img src="${window.location.origin}/icons/logo.png" onerror="this.style.display='none'"/>
    <div><h1>${esc(event?.titre || 'Composition')}</h1>
    <p class="sub">${esc(dateStr)}${event?.lieu ? ' · ' + esc(event.lieu) : ''} · ${esc(formation.label)}${capitaine ? ' · Capitaine : ' + esc(nomComplet(capitaine)) : ''}</p></div>
  </div>
  <div class="main">
    <div class="pitch">${svg}</div>
    <div class="side">
      <h2>Titulaires</h2><table>${titulaires}</table>
      ${remplacants ? `<h2>Remplaçants</h2><table>${remplacants}</table>` : ''}
    </div>
  </div>
  <div class="footer">FC PCL · FootCoach App</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
  </body></html>`)
  win.document.close()
}
