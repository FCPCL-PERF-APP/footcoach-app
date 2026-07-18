-- Corrige la contrainte de la table presences : le statut 'exterieur' (utilisé par
-- l'appli pour un entraînement individuel/extérieur, cf. src/pages/CalendrierPage.jsx)
-- n'était pas autorisé par la contrainte posée dans supabase-migration.sql, qui ne
-- listait que 'present', 'absent', 'blesse', 'inconnu'. Toute tentative d'enregistrer
-- une présence "extérieur" échoue donc silencieusement côté base depuis l'ajout de ce
-- statut dans le code.
ALTER TABLE presences DROP CONSTRAINT IF EXISTS presences_statut_check;
ALTER TABLE presences ADD CONSTRAINT presences_statut_check
  CHECK (statut IN ('present', 'absent', 'blesse', 'inconnu', 'exterieur'));
