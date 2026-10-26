-- Suivi du match en direct pour les joueurs absents/blessés/non convoqués.
-- Le coach publie, à chaque fait de jeu saisi dans Suivi live, une version ASSAINIE de la
-- chronologie (minute, type, noms — jamais les notes ni le rapport, qui restent privés).
CREATE TABLE IF NOT EXISTS match_live (
  evenement_id uuid PRIMARY KEY REFERENCES evenements(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'en_cours',      -- en_cours | mi_temps | seconde_mt | termine
  score_pour int NOT NULL DEFAULT 0,
  score_contre int NOT NULL DEFAULT 0,
  faits jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE match_live ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_live_read" ON match_live;
CREATE POLICY "match_live_read" ON match_live FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "match_live_write" ON match_live;
CREATE POLICY "match_live_write" ON match_live FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.auth_id = auth.uid()));

-- Mise à jour instantanée côté joueur (Realtime). Ignore l'erreur si déjà ajoutée.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE match_live;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Composition affichée aux joueurs pendant la diffusion (formation, postes, noms, numéros,
-- capitaine, remplaçants) — version publique figée par le coach, sans rien d'autre du rapport.
ALTER TABLE match_live ADD COLUMN IF NOT EXISTS compo jsonb;
