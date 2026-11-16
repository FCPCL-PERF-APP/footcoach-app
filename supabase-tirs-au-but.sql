-- Tirs au but (matchs de coupe terminés sur un nul) : nos tireurs dans l'ordre,
-- réussis ou ratés, et le score de la séance.
ALTER TABLE stats_collectives ADD COLUMN IF NOT EXISTS tab_tireurs jsonb;      -- [{ "joueur_id": "...", "reussi": true }, ...]
ALTER TABLE stats_collectives ADD COLUMN IF NOT EXISTS tab_marques smallint;   -- nos tirs au but réussis
ALTER TABLE stats_collectives ADD COLUMN IF NOT EXISTS tab_encaisses smallint; -- tirs au but réussis par l'adversaire

-- Vérification : doit afficher 3 lignes
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stats_collectives' AND column_name LIKE 'tab_%';
