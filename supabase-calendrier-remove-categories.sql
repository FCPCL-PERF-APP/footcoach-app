-- Retire réunion_technique, test et animation des catégories disponibles sur le
-- calendrier général (plus utilisées côté appli). Supprime d'abord les lignes
-- existantes de ces catégories (sécurité, au cas où), puis resserre la contrainte.
DELETE FROM calendrier_jours WHERE categorie IN ('reunion_technique', 'test', 'animation');

ALTER TABLE calendrier_jours DROP CONSTRAINT IF EXISTS calendrier_jours_categorie_check;
ALTER TABLE calendrier_jours ADD CONSTRAINT calendrier_jours_categorie_check
  CHECK (categorie IN ('vacances_scolaires', 'jour_ferie', 'semaine_coupure'));
