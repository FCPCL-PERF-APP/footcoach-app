// Config minimale des tests (indépendante de vite.config.js : pas besoin du plugin PWA ici).
// preserveSymlinks : node_modules est un lien vers node_modules.nosync (pour que iCloud
// ne synchronise pas ces ~30 000 fichiers) — sans cette option, vitest charge deux copies
// de lui-même via le lien et l'environnement jsdom ne trouve plus aucun test.
export default {
  resolve: { preserveSymlinks: true },
  test: { include: ['src/**/*.test.js'] },
}
