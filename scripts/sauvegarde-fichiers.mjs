// Télécharge tous les fichiers des espaces de stockage Supabase (photos, ressources...)
// dans un dossier local, en conservant l'arborescence. Sans dépendance (Node 20+).
//
// Usage : SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/sauvegarde-fichiers.mjs <dossier>
// Utilisé chaque semaine par .github/workflows/sauvegarde-fichiers.yml (copie chiffrée).

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const BUCKETS = ['joueurs', 'ressources']
const PAGE = 1000

// Liste récursivement les fichiers d'un bucket. Dans la réponse de Storage, un
// élément sans `id` est un dossier.
export async function listerFichiers(appel, bucket, prefixe = '') {
  const fichiers = []
  for (let offset = 0; ; offset += PAGE) {
    const items = await appel(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: prefixe, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    for (const it of items) {
      const chemin = prefixe ? `${prefixe}/${it.name}` : it.name
      if (it.id == null) fichiers.push(...await listerFichiers(appel, bucket, chemin))
      else fichiers.push({ chemin, taille: it.metadata?.size ?? 0 })
    }
    if (items.length < PAGE) return fichiers
  }
}

function client(url, cle) {
  const headers = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' }
  return async (route, options = {}) => {
    const res = await fetch(url + route, { ...options, headers })
    if (!res.ok) throw new Error(`${options.method || 'GET'} ${route} : HTTP ${res.status} ${await res.text()}`)
    return route.includes('/object/list/') ? res.json() : Buffer.from(await res.arrayBuffer())
  }
}

async function main() {
  const [dossier] = process.argv.slice(2)
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const cle = process.env.SUPABASE_SERVICE_KEY
  if (!dossier || !url || !cle) {
    console.error('Usage : SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/sauvegarde-fichiers.mjs <dossier>')
    process.exit(1)
  }
  const appel = client(url, cle)
  let total = 0, octets = 0
  for (const bucket of BUCKETS) {
    const fichiers = await listerFichiers(appel, bucket)
    for (const f of fichiers) {
      const contenu = await appel(`/storage/v1/object/authenticated/${bucket}/${f.chemin.split('/').map(encodeURIComponent).join('/')}`)
      const cible = join(dossier, bucket, f.chemin)
      await mkdir(dirname(cible), { recursive: true })
      await writeFile(cible, contenu)
      total++; octets += contenu.length
    }
    console.log(`${bucket} : ${fichiers.length} fichier(s)`)
  }
  console.log(`Total : ${total} fichier(s), ${(octets / 1024 / 1024).toFixed(1)} Mo`)
  if (total === 0) { console.error('Aucun fichier trouvé : sauvegarde anormale'); process.exit(1) }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(err => { console.error(err.message); process.exit(1) })
