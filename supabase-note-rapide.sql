-- Note rapide du coach (1 à 5) par joueur et par match, saisie dans la Feuille de match.
-- Les 4 critères détaillés (perf_individuelle, investissement, consignes, qualite_technique)
-- restent facultatifs ; s'ils sont remplis, leur moyenne prime pour la note /10.
ALTER TABLE rpe_coach ADD COLUMN IF NOT EXISTS note_globale smallint;
ALTER TABLE rpe_coach DROP CONSTRAINT IF EXISTS rpe_coach_note_globale_check;
ALTER TABLE rpe_coach ADD CONSTRAINT rpe_coach_note_globale_check CHECK (note_globale IS NULL OR note_globale BETWEEN 1 AND 5);

-- Vérification : doit afficher 1 ligne
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rpe_coach' AND column_name = 'note_globale';
