-- Refonte des items RPE Coach : difficulté/fatigue/implication/motivation sont des
-- ressentis internes que le coach ne peut pas juger de façon fiable de l'extérieur
-- (déjà couverts par le RPE auto-déclaré du joueur). Remplacés par des critères que le
-- coach peut réellement observer : performance individuelle (gardée), investissement/
-- intensité, respect des consignes, qualité technique.
ALTER TABLE rpe_coach ADD COLUMN IF NOT EXISTS investissement int;
ALTER TABLE rpe_coach ADD COLUMN IF NOT EXISTS consignes int;
ALTER TABLE rpe_coach ADD COLUMN IF NOT EXISTS qualite_technique int;
ALTER TABLE rpe_coach DROP COLUMN IF EXISTS difficulte;
ALTER TABLE rpe_coach DROP COLUMN IF EXISTS fatigue;
ALTER TABLE rpe_coach DROP COLUMN IF EXISTS implication;
ALTER TABLE rpe_coach DROP COLUMN IF EXISTS motivation;
