-- « Mot du coach » : message court du staff à un joueur, affiché dans sa carte « Ma semaine ».
CREATE TABLE IF NOT EXISTS mots_coach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joueur_id uuid NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
  texte text NOT NULL CHECK (char_length(texte) BETWEEN 1 AND 500),
  auteur_id uuid DEFAULT auth.uid(),
  auteur_nom text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mots_coach_joueur_idx ON mots_coach (joueur_id, created_at DESC);

ALTER TABLE mots_coach ENABLE ROW LEVEL SECURITY;
-- Le staff lit et écrit tout ; un joueur ne lit que les mots qui lui sont adressés.
DROP POLICY IF EXISTS mots_coach_staff ON mots_coach;
CREATE POLICY mots_coach_staff ON mots_coach FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
DROP POLICY IF EXISTS mots_coach_joueur_lit ON mots_coach;
CREATE POLICY mots_coach_joueur_lit ON mots_coach FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM joueurs j WHERE j.id = mots_coach.joueur_id AND j.auth_id = auth.uid()));

-- Vérification : doit afficher 2 lignes
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'mots_coach';
