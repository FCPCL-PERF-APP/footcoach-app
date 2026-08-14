-- RPE "perçu par le coach" — la même échelle que le RPE auto-déclaré par les joueurs
-- (difficulté/fatigue/implication/motivation/perf individuelle), mais remplie par le
-- coach lui-même pour chaque joueur, sur une séance d'entraînement ou un match. Table
-- séparée de "rpe" (auto-déclaratif joueur) : les deux coexistent pour un même
-- évenement/joueur sans se marcher dessus.
CREATE TABLE IF NOT EXISTS rpe_coach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  joueur_id uuid NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
  difficulte int,
  fatigue int,
  implication int,
  motivation int,
  perf_individuelle int,
  created_at timestamptz DEFAULT now(),
  UNIQUE(evenement_id, joueur_id)
);

ALTER TABLE rpe_coach ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rpe_coach_authenticated" ON rpe_coach;
CREATE POLICY "rpe_coach_authenticated" ON rpe_coach FOR ALL TO authenticated USING (true) WITH CHECK (true);
