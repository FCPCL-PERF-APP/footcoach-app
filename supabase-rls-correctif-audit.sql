-- Correctif issu de l'audit de cohérence (novembre 2026) :
--  A. Tables encore ouvertes aux visiteurs NON connectés (clé anon publique) → réservées aux comptes connectés
--     (+ écriture réservée au staff sur evenements, stats_match, ressources, archives_saisons).
--  B. Données sensibles par joueur (rpe, footbar, blessures...) : l'audit montre que
--     supabase-rls-donnees-sensibles.sql n'est PAS en vigueur → réappliqué ici à l'identique.
-- Une seule exécution ; en cas d'erreur, rien n'est modifié (transaction) : envoie-moi le message.

CREATE OR REPLACE FUNCTION public.fc_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE auth_id = auth.uid())
$$;

-- Supprime toutes les policies des tables concernées (quel que soit leur nom), pour qu'aucune
-- ancienne règle « accès total » ne subsiste à côté des nouvelles.
DO $$
DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'blessures','rpe','rpe_coach','footbar','suivi_poids','tests_physiques','commentaires_joueurs','forme_joueur',
    'evenements','stats_match','ressources','archives_saisons',
    'cpa','objectifs','objectifs_joueur','onze_ideal','pronostics','sondages','sondage_votes'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Table staff : retire uniquement la lecture ouverte aux visiteurs (celle réservée aux comptes connectés reste)
DROP POLICY IF EXISTS "Staff can read all" ON staff;

-- A1. Lecture : tout compte connecté ; écriture : staff
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['evenements','stats_match','ressources','archives_saisons'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_read_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (fc_is_staff()) WITH CHECK (fc_is_staff())', t || '_write_staff', t);
  END LOOP;
END $$;

-- A2. Tables d'usage partagé : accès complet pour les comptes connectés (comportement actuel, sans les visiteurs)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cpa','objectifs','objectifs_joueur','onze_ideal','pronostics','sondages','sondage_votes'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_authenticated', t);
  END LOOP;
END $$;

-- B. Données sensibles : joueur = ses lignes, staff = tout
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

CREATE POLICY blessures_read_own_or_staff ON blessures FOR SELECT TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY blessures_write_staff ON blessures FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
CREATE POLICY tests_physiques_read_own_or_staff ON tests_physiques FOR SELECT TO authenticated
  USING (fc_is_staff() OR joueur_id IN (SELECT id FROM joueurs WHERE auth_id = auth.uid()));
CREATE POLICY tests_physiques_write_staff ON tests_physiques FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());

CREATE POLICY commentaires_joueurs_staff ON commentaires_joueurs FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
CREATE POLICY rpe_coach_staff ON rpe_coach FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());
