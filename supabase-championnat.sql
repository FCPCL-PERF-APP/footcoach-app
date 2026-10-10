-- Classement du championnat : une ligne par match de la poule (toutes équipes).
-- Le classement et la forme sont calculés par l'appli à partir de ces résultats.
CREATE TABLE IF NOT EXISTS championnat_matchs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saison int NOT NULL,
  journee int NOT NULL,
  date_match date,
  equipe_dom text NOT NULL,
  equipe_ext text NOT NULL,
  score_dom int,
  score_ext int,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS championnat_matchs_saison_idx ON championnat_matchs (saison, journee);

-- Nom de notre équipe dans le championnat (mis en évidence dans le classement)
CREATE TABLE IF NOT EXISTS championnat_config (
  saison int PRIMARY KEY,
  notre_equipe text
);

ALTER TABLE championnat_matchs ENABLE ROW LEVEL SECURITY;
ALTER TABLE championnat_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "championnat_matchs_read" ON championnat_matchs;
CREATE POLICY "championnat_matchs_read" ON championnat_matchs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "championnat_matchs_write" ON championnat_matchs;
CREATE POLICY "championnat_matchs_write" ON championnat_matchs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_id = auth.uid() AND staff.role IN ('coach','admin','adjoint')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.auth_id = auth.uid() AND staff.role IN ('coach','admin','adjoint')));

DROP POLICY IF EXISTS "championnat_config_read" ON championnat_config;
CREATE POLICY "championnat_config_read" ON championnat_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "championnat_config_write" ON championnat_config;
CREATE POLICY "championnat_config_write" ON championnat_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_id = auth.uid() AND staff.role IN ('coach','admin','adjoint')))
  WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.auth_id = auth.uid() AND staff.role IN ('coach','admin','adjoint')));
