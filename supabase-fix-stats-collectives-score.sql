-- Le formulaire "Stats collectives" propose les champs "Score mi-temps" et "Score
-- final" depuis longtemps, mais les colonnes correspondantes n'ont jamais été créées
-- sur la table stats_collectives — la sauvegarde échouait silencieusement jusqu'ici
-- (vérification d'erreur ajoutée récemment, qui a fait apparaître l'échec pour la
-- première fois plutôt que de créer un nouveau bug).
ALTER TABLE stats_collectives ADD COLUMN IF NOT EXISTS score_mi_temps text;
ALTER TABLE stats_collectives ADD COLUMN IF NOT EXISTS score_final text;
