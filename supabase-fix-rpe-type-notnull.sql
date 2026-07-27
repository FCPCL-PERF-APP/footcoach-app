-- La colonne "type" de la table rpe est restée NOT NULL en base après une refonte du
-- code (juin 2026) qui a arrêté de l'envoyer (info redondante avec evenements.type,
-- récupérée par jointure). Résultat : tout joueur saisissant un RPE pour la première
-- fois sur un événement (INSERT, pas UPDATE) obtient l'erreur "null value in column
-- 'type' of relation 'rpe' violates not-null constraint". La colonne n'étant utilisée
-- nulle part dans le code applicatif, on retire simplement la contrainte.
ALTER TABLE rpe ALTER COLUMN type DROP NOT NULL;
