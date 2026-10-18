-- Durcissement RLS des données sensibles par joueur (santé, charge, forme, commentaires).
-- Avant : n'importe quel compte connecté (même un joueur) pouvait lire/modifier les lignes
-- de TOUS les joueurs via l'API Supabase (la clé anon est dans le JS de l'appli).
-- Après : un joueur ne voit et n'écrit que SES lignes ; le staff (table staff) voit tout.
--   rpe, footbar, suivi_poids, forme_joueur : joueur = ses lignes (lecture + écriture), staff = tout
--   blessures, tests_physiques               : joueur = lecture de ses lignes, écriture staff
--   commentaires_joueurs, rpe_coach          : staff uniquement
-- Vérifié dans le code : aucune page joueur ne lit ces tables hors de ses propres lignes.
-- Les routes /api (cron, notifications) utilisent la clé service : non concernées.
-- Rollback : supabase-rls-donnees-sensibles-rollback.sql

CREATE OR REPLACE FUNCTION public.fc_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE auth_id = auth.uid())
$$;

-- Supprime TOUTES les policies existantes de ces tables (quel que soit leur nom) : une
-- ancienne policy "USING (true)" encore présente annulerait les nouvelles (les policies
-- permissives s'additionnent).
DO $$
DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blessures','rpe','rpe_coach','footbar','suivi_poids','tests_physiques','commentaires_joueurs','forme_joueur'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Joueur = ses lignes (lecture + écriture), staff = tout
CREATE POLICY rpe_own_or_staff ON rpe FOR ALL TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()))
  WITH CHECK (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY footbar_own_or_staff ON footbar FOR ALL TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()))
  WITH CHECK (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY suivi_poids_own_or_staff ON suivi_poids FOR ALL TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()))
  WITH CHECK (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY forme_joueur_own_or_staff ON forme_joueur FOR ALL TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()))
  WITH CHECK (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));

-- Joueur = lecture de ses lignes ; écriture staff
CREATE POLICY blessures_read_own_or_staff ON blessures FOR SELECT TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY blessures_write_staff ON blessures FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
CREATE POLICY tests_physiques_read_own_or_staff ON tests_physiques FOR SELECT TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY tests_physiques_write_staff ON tests_physiques FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());

-- Staff uniquement
CREATE POLICY commentaires_joueurs_staff ON commentaires_joueurs FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
CREATE POLICY rpe_coach_staff ON rpe_coach FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
