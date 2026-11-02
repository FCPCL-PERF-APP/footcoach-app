-- AUDIT DE COHÉRENCE DE LA BASE — LECTURE SEULE (aucune modification).
-- À coller dans Supabase > SQL Editor puis exécuter. Renvoie un tableau de constats ;
-- copie-colle-moi le résultat (ou une capture) pour que je traite chaque ligne.
--   ERREUR   = l'appli casse ou perd des données tant que ce n'est pas corrigé
--   ATTENTION = incohérence ou risque à traiter
--   INFO     = pour information

SELECT * FROM (

-- 1. Contraintes d'unicité nécessaires aux enregistrements (upsert)
SELECT 'ERREUR' AS severite, 'Unicité manquante' AS controle, t.tbl AS objet,
       'Il faut UNIQUE(' || t.cols || ') : sans ça chaque enregistrement échoue' AS detail
FROM (VALUES
    ('presences','evenement_id,joueur_id'),
    ('rpe','evenement_id,joueur_id'),
    ('footbar','evenement_id,joueur_id'),
    ('stats_match','evenement_id,joueur_id'),
    ('convocations','evenement_id,joueur_id'),
    ('rpe_coach','evenement_id,joueur_id'),
    ('stats_collectives','evenement_id'),
    ('rapports_match','evenement_id'),
    ('message_lectures','user_id,canal'),
    ('push_subscriptions','endpoint'),
    ('notif_relances','evenement_id,joueur_id,type'),
    ('match_live','evenement_id'),
    ('championnat_config','saison')
) AS t(tbl, cols)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = t.tbl AND i.indisunique AND i.indpred IS NULL
    AND (SELECT string_agg(a.attname::text, ',' ORDER BY a.attname::text) FROM pg_attribute a
         WHERE a.attrelid = c.oid AND a.attnum = ANY(i.indkey))
      = (SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array(t.cols, ',')) AS x)
)
UNION ALL
-- 2. Colonnes attendues par l'appli
SELECT 'ERREUR', 'Colonne manquante', t.tbl || '.' || t.col,
       'L''appli lit ou écrit cette colonne : migration SQL non appliquée ?'
FROM (VALUES
    ('rapports_match','formation'),
    ('rapports_match','compo_visuelle'),
    ('rapports_match','banc'),
    ('rapports_match','capitaine_id'),
    ('rapports_match','chronologie'),
    ('rapports_match','terrain_marks'),
    ('rapports_match','recap_mi_temps'),
    ('evenements','commentaire'),
    ('evenements','match_type'),
    ('evenements','rdv_heure'),
    ('evenements','rdv_lieu'),
    ('stats_collectives','duree_match'),
    ('stats_collectives','score_mi_temps'),
    ('stats_collectives','score_final'),
    ('presences','motif'),
    ('joueurs','archive'),
    ('joueurs','archive_le'),
    ('joueurs','last_seen'),
    ('staff','last_seen'),
    ('match_live','compo'),
    ('push_subscriptions','endpoint'),
    ('push_subscriptions','subscription'),
    ('rpe_coach','investissement'),
    ('rpe_coach','consignes'),
    ('rpe_coach','qualite_technique'),
    ('rpe_coach','perf_individuelle'),
    ('footbar','distance_km'),
    ('footbar','sprint_max'),
    ('footbar','sprints'),
    ('footbar','distance_hi'),
    ('footbar','temps_jeu'),
    ('footbar','ballons_touches'),
    ('footbar','nb_passes'),
    ('footbar','nb_tirs'),
    ('stats_match','temps_jeu'),
    ('stats_match','titulaire'),
    ('stats_match','carton_jaune'),
    ('stats_match','carton_rouge'),
    ('messages','image_url'),
    ('messages','reactions'),
    ('messages','canal'),
    ('messages','lu'),
    ('blessures','date_retour_effective')
) AS t(tbl, col)
WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col)
UNION ALL
-- 3. Colonnes obligatoires SANS valeur par défaut sur les tables où l'appli écrit
--    (cause du bug rpe.type / footbar : l'INSERT échoue si l'appli n'envoie pas la colonne)
SELECT 'ATTENTION', 'Colonne obligatoire sans défaut', c.table_name || '.' || c.column_name,
       'type ' || c.data_type || ' — vérifier que l''appli l''envoie toujours, sinon retirer NOT NULL'
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name IN ('presences','rpe','footbar','stats_match','stats_collectives','rapports_match','convocations','rpe_coach','evenements','blessures','messages','message_lectures','forme_joueur','suivi_poids','commentaires_joueurs','match_live')
  AND c.is_nullable = 'NO' AND c.column_default IS NULL AND c.is_identity = 'NO'
  AND c.column_name NOT IN ('id')
UNION ALL
-- 4. Doublons sur les clés d'enregistrement
SELECT 'ERREUR', 'Doublons', 'presences', n || ' groupe(s) en doublon sur (evenement_id,joueur_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM presences GROUP BY evenement_id,joueur_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'rpe', n || ' groupe(s) en doublon sur (evenement_id,joueur_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM rpe GROUP BY evenement_id,joueur_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'footbar', n || ' groupe(s) en doublon sur (evenement_id,joueur_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM footbar GROUP BY evenement_id,joueur_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'stats_match', n || ' groupe(s) en doublon sur (evenement_id,joueur_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM stats_match GROUP BY evenement_id,joueur_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'convocations', n || ' groupe(s) en doublon sur (evenement_id,joueur_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM convocations GROUP BY evenement_id,joueur_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'rpe_coach', n || ' groupe(s) en doublon sur (evenement_id,joueur_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM rpe_coach GROUP BY evenement_id,joueur_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'stats_collectives', n || ' groupe(s) en doublon sur (evenement_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM stats_collectives GROUP BY evenement_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
SELECT 'ERREUR', 'Doublons', 'rapports_match', n || ' groupe(s) en doublon sur (evenement_id)'
FROM (SELECT count(*)::text AS n FROM (SELECT 1 FROM rapports_match GROUP BY evenement_id HAVING count(*) > 1) d) x WHERE n <> '0'
UNION ALL
-- 5. Données rattachées à un joueur/événement qui n'existe plus
SELECT 'ATTENTION', 'Lignes orphelines', 'presences.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM presences x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'presences.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM presences x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'rpe.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM rpe x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'rpe.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM rpe x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'footbar.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM footbar x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'footbar.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM footbar x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'stats_match.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM stats_match x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'stats_match.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM stats_match x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'convocations.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM convocations x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'convocations.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM convocations x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'blessures.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM blessures x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'rpe_coach.joueur_id', n || ' ligne(s) pointent vers un(e) joueur supprimé(e)'
FROM (SELECT count(*)::text AS n FROM rpe_coach x WHERE x.joueur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM joueurs r WHERE r.id = x.joueur_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'rpe_coach.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM rpe_coach x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'stats_collectives.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM stats_collectives x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
SELECT 'ATTENTION', 'Lignes orphelines', 'rapports_match.evenement_id', n || ' ligne(s) pointent vers un(e) evenement supprimé(e)'
FROM (SELECT count(*)::text AS n FROM rapports_match x WHERE x.evenement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evenements r WHERE r.id = x.evenement_id)) y WHERE n <> '0'
UNION ALL
-- 6a. Tables sans RLS (accessibles à toute personne ayant la clé publique de l'appli)
SELECT 'ERREUR', 'RLS désactivé', c.relname, 'Lecture/écriture ouverte sans connexion tant que RLS n''est pas activé'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
-- 6b. Règles ouvertes même aux visiteurs NON connectés (rôle public/anon)
SELECT 'ERREUR', 'Règle ouverte à tous', p.tablename || ' → ' || p.policyname,
       'cmd ' || p.cmd || ', accessible sans être connecté'
FROM pg_policies p
WHERE p.schemaname = 'public' AND ('public' = ANY(p.roles) OR 'anon' = ANY(p.roles))
  AND (p.qual = 'true' OR p.with_check = 'true')
UNION ALL
-- 6c. Tables encore lisibles/modifiables par TOUT compte connecté (même un joueur)
SELECT 'INFO', 'Ouvert à tout compte connecté', p.tablename,
       string_agg(DISTINCT p.cmd, ', ') || ' — à restreindre si la table contient des données personnelles'
FROM pg_policies p
WHERE p.schemaname = 'public' AND NOT ('public' = ANY(p.roles) OR 'anon' = ANY(p.roles))
  AND (p.qual = 'true' OR p.with_check = 'true')
GROUP BY p.tablename

) r
ORDER BY CASE severite WHEN 'ERREUR' THEN 1 WHEN 'ATTENTION' THEN 2 ELSE 3 END, controle, objet;
