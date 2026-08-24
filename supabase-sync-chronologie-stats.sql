-- Base du calcul du temps de jeu depuis les changements de la chronologie (Suivi
-- live) — 90' par défaut si laissé vide. Aucune autre migration nécessaire : les
-- précisions ajoutées aux événements de la chronologie (buteur, passeur, phase,
-- joueur carton, sortant/entrant) sont de nouvelles clés dans la colonne jsonb
-- rapports_match.chronologie déjà existante (v309), pas de nouvelle colonne.
ALTER TABLE stats_collectives ADD COLUMN IF NOT EXISTS duree_match int;
