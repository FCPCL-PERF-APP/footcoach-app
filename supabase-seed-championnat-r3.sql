-- Pré-remplit le championnat 2026-2027 avec NOS matchs (déjà dans l'agenda, import R3 /
-- Poule G), dans l'ordre chronologique = journées 1 à 22, avec le score pour ceux déjà
-- joués (stats collectives). Les matchs des autres équipes sont à ajouter ensuite via le
-- bouton « Importer » de la page Championnat. À lancer APRÈS supabase-championnat.sql.
-- Sans effet si des matchs existent déjà pour la saison 2026.
INSERT INTO championnat_config (saison, notre_equipe)
VALUES (2026, 'Plouagat Chat Lan Fc')
ON CONFLICT (saison) DO UPDATE SET notre_equipe = EXCLUDED.notre_equipe;

INSERT INTO championnat_matchs (saison, journee, date_match, equipe_dom, equipe_ext, score_dom, score_ext)
SELECT 2026,
       row_number() OVER (ORDER BY e.date_heure),
       e.date_heure::date,
       CASE WHEN e.domicile THEN 'Plouagat Chat Lan Fc' ELSE trim(regexp_replace(e.titre, '^vs\s+', '')) END,
       CASE WHEN e.domicile THEN trim(regexp_replace(e.titre, '^vs\s+', '')) ELSE 'Plouagat Chat Lan Fc' END,
       CASE WHEN sc.buts_marques IS NULL OR e.date_heure > now() THEN NULL
            WHEN e.domicile THEN sc.buts_marques ELSE sc.buts_encaisses END,
       CASE WHEN sc.buts_marques IS NULL OR e.date_heure > now() THEN NULL
            WHEN e.domicile THEN sc.buts_encaisses ELSE sc.buts_marques END
FROM evenements e
LEFT JOIN stats_collectives sc ON sc.evenement_id = e.id
WHERE e.type = 'match' AND e.match_type = 'championnat'
  AND e.date_heure >= '2026-07-01' AND e.date_heure < '2027-07-01'
  AND NOT EXISTS (SELECT 1 FROM championnat_matchs WHERE saison = 2026);
