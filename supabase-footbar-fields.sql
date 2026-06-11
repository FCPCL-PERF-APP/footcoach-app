-- Ajouter les nouveaux champs Footbar
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS sprint_max decimal;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS temps_jeu integer;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS nb_passes integer;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS nb_tirs integer;
