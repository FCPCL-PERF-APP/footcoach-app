-- Calendrier général de la saison — vue d'ensemble (vacances scolaires, jours fériés,
-- semaine de coupure, réunions techniques, tests, animations) éditable par le staff,
-- visible par tous. Les matchs (championnat/coupe/amical) ne sont PAS dupliqués ici :
-- ils sont recalculés à l'affichage depuis la table evenements (source unique de
-- vérité), donc pas de risque de désynchronisation si un match est déplacé.
CREATE TABLE IF NOT EXISTS calendrier_jours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  categorie text NOT NULL CHECK (categorie IN (
    'vacances_scolaires', 'jour_ferie', 'semaine_coupure',
    'reunion_technique', 'test', 'animation'
  )),
  label text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calendrier_jours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendrier_jours_select" ON calendrier_jours;
CREATE POLICY "calendrier_jours_select" ON calendrier_jours
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "calendrier_jours_insert_staff" ON calendrier_jours;
CREATE POLICY "calendrier_jours_insert_staff" ON calendrier_jours
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "calendrier_jours_update_staff" ON calendrier_jours;
CREATE POLICY "calendrier_jours_update_staff" ON calendrier_jours
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "calendrier_jours_delete_staff" ON calendrier_jours;
CREATE POLICY "calendrier_jours_delete_staff" ON calendrier_jours
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );
