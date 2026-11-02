-- Charge d'entraînement « sRPE » (méthode Foster) : intensité 0-10 × durée en minutes.
-- 1) Intensité de l'effort ressentie par le joueur, de 0 (repos) à 10 (maximal).
ALTER TABLE rpe ADD COLUMN IF NOT EXISTS intensite smallint;
ALTER TABLE rpe DROP CONSTRAINT IF EXISTS rpe_intensite_check;
ALTER TABLE rpe ADD CONSTRAINT rpe_intensite_check CHECK (intensite IS NULL OR intensite BETWEEN 0 AND 10);

-- 2) Durée réelle d'une séance, en minutes (vide = 90 min par défaut dans l'appli).
--    Pour un match, l'appli utilise le temps de jeu de chaque joueur s'il est saisi.
ALTER TABLE evenements ADD COLUMN IF NOT EXISTS duree_min smallint;
ALTER TABLE evenements DROP CONSTRAINT IF EXISTS evenements_duree_min_check;
ALTER TABLE evenements ADD CONSTRAINT evenements_duree_min_check CHECK (duree_min IS NULL OR duree_min BETWEEN 1 AND 300);

-- Vérification : doit afficher 2 lignes
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND ((table_name = 'rpe' AND column_name = 'intensite') OR (table_name = 'evenements' AND column_name = 'duree_min'));
