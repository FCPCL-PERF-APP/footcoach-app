-- Pénaltys tirés pendant le temps réglementaire, par joueur et par match.
ALTER TABLE stats_match ADD COLUMN IF NOT EXISTS penaltys_marques smallint;
ALTER TABLE stats_match ADD COLUMN IF NOT EXISTS penaltys_rates smallint;

-- Reprise de l'existant : les buts « phase Penalty » déjà notés dans la chronologie
-- des matchs passés sont comptés comme pénaltys marqués.
WITH p AS (
  SELECT r.evenement_id, (e->>'buteur_id')::uuid AS joueur_id, count(*)::smallint AS marques
  FROM rapports_match r
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.chronologie::jsonb) = 'array' THEN r.chronologie::jsonb ELSE '[]'::jsonb END) e
  WHERE e->>'type' = 'but_pour' AND e->>'phase' = 'penalty' AND coalesce(e->>'buteur_id', '') <> ''
  GROUP BY 1, 2
)
UPDATE stats_match s SET penaltys_marques = p.marques
FROM p WHERE s.evenement_id = p.evenement_id AND s.joueur_id = p.joueur_id;

-- Vérification : colonnes créées et nombre de pénaltys repris
SELECT 'colonnes' AS controle, count(*)::text AS valeur FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stats_match' AND column_name LIKE 'penaltys_%'
UNION ALL
SELECT 'penaltys repris', coalesce(sum(penaltys_marques), 0)::text FROM stats_match;
