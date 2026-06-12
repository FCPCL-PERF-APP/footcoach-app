export function exportRapportPDF(rapport, event, stats, compo) {
  const win = window.open('', '_blank')
  if (!win) { alert('Autorise les popups pour exporter le PDF.'); return }

  const dateStr = event?.date_heure
    ? new Date(event.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
  <title>Rapport — ${event?.titre || 'Match'}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px}
    .header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1A3A6B;padding-bottom:12px;margin-bottom:16px}
    .header img{width:60px;height:60px;border-radius:50%;object-fit:cover}
    h1{font-size:18px;color:#1A3A6B}
    .score-box{display:flex;justify-content:center;align-items:center;gap:20px;background:#1A3A6B;color:white;padding:12px;border-radius:8px;margin-bottom:16px}
    .score{font-size:28px;font-weight:bold}
    .section{margin-bottom:14px}
    .section-title{font-size:13px;font-weight:bold;color:#1A3A6B;border-bottom:1px solid #1A3A6B;padding-bottom:4px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
    .field{margin-bottom:8px}
    .field label{font-size:10px;color:#666;display:block;margin-bottom:2px;text-transform:uppercase}
    .field p{font-size:12px;border:1px solid #ddd;border-radius:4px;padding:5px 8px;min-height:24px;background:#fafafa}
    .tv{font-size:11px;border:1px solid #ddd;border-radius:4px;padding:6px 8px;min-height:50px;background:#fafafa;white-space:pre-wrap}
    .compo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .compo-slot{border:1px solid #ddd;border-radius:4px;padding:4px 6px;font-size:11px;background:#f0f4ff}
    .footer{margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center}
    @media print{body{padding:10px}}
  </style></head><body>
  <div class="header">
    <img src="${window.location.origin}/icons/logo.jpg" onerror="this.style.display='none'" />
    <div><h1>FC PCL — Rapport de match</h1>
    <p style="color:#666;margin-top:2px">${event?.titre || ''} · ${dateStr}</p>
    <p style="color:#666">${event?.domicile ? 'Domicile' : 'Déplacement'} · ${event?.lieu || ''}</p></div>
  </div>
  ${rapport?.score_final ? `<div class="score-box">
    <div style="text-align:right"><div style="font-size:11px;opacity:.8">FC PCL</div><div class="score">${rapport.score_final.split('-')[0]?.trim() || '—'}</div></div>
    <div style="opacity:.7">—</div>
    <div><div style="font-size:11px;opacity:.8">${event?.titre?.replace('vs ','') || 'Adversaire'}</div><div class="score">${rapport.score_final.split('-')[1]?.trim() || '—'}</div></div>
  </div>` : ''}
  <div class="section"><div class="section-title">Informations match</div>
    <div class="grid3">
      <div class="field"><label>Score mi-temps</label><p>${rapport?.score_mi_temps || '—'}</p></div>
      <div class="field"><label>Score final</label><p>${rapport?.score_final || '—'}</p></div>
      <div class="field"><label>Arbitre</label><p>${rapport?.arbitre || '—'}</p></div>
    </div>
  </div>
  ${(compo || []).filter(Boolean).length > 0 ? `<div class="section"><div class="section-title">Composition</div>
    <div class="compo-grid">${(compo || []).map((n,i) => `<div class="compo-slot"><div style="font-size:9px;color:#666">N°${i+1}</div><div>${n||'—'}</div></div>`).join('')}</div>
  </div>` : ''}
  <div class="section"><div class="section-title">Analyse tactique</div>
    <div class="field"><label>Causerie d'avant-match</label><div class="tv">${rapport?.causerie || '—'}</div></div>
    <div class="grid2">
      <div class="field"><label>Animation offensive</label><div class="tv">${rapport?.animation_offensive || '—'}</div></div>
      <div class="field"><label>Animation défensive</label><div class="tv">${rapport?.animation_defensive || '—'}</div></div>
    </div>
  </div>
  <div class="section"><div class="section-title">Analyse du match</div>
    <div class="grid2">
      <div class="field"><label>✅ Offensif — Points positifs</label><div class="tv">${rapport?.points_positifs_off || '—'}</div></div>
      <div class="field"><label>⚠️ Offensif — Problèmes</label><div class="tv">${rapport?.problemes_off || '—'}</div></div>
      <div class="field"><label>✅ Défensif — Points positifs</label><div class="tv">${rapport?.points_positifs_def || '—'}</div></div>
      <div class="field"><label>⚠️ Défensif — Problèmes</label><div class="tv">${rapport?.problemes_def || '—'}</div></div>
    </div>
    <div class="field"><label>Points forts globaux</label><div class="tv">${rapport?.points_forts_globaux || '—'}</div></div>
    <div class="field"><label>Points faibles globaux</label><div class="tv">${rapport?.points_faibles_globaux || '—'}</div></div>
    <div class="field"><label>Composition adversaire</label><div class="tv">${rapport?.compo_adversaire || '—'}</div></div>
  </div>
  ${stats ? `<div class="section"><div class="section-title">Statistiques collectives</div>
    <div class="grid3">
      <div class="field"><label>Buts marqués</label><p>${stats.buts_marques ?? '—'}</p></div>
      <div class="field"><label>Buts encaissés</label><p>${stats.buts_encaisses ?? '—'}</p></div>
      <div class="field"><label>Attaque placée</label><p>${stats.attaque_placee ?? '—'}</p></div>
      <div class="field"><label>Contre-attaque</label><p>${stats.contre_attaque ?? '—'}</p></div>
      <div class="field"><label>Corner</label><p>${stats.corner ?? '—'}</p></div>
      <div class="field"><label>Pénalty</label><p>${stats.penalty ?? '—'}</p></div>
    </div>
  </div>` : ''}
  <div class="footer">FC PCL · FootCoach App · Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`

  win.document.write(html)
  win.document.close()
}
