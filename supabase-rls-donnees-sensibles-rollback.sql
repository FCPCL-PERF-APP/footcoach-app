-- Retour à l'état précédent (accès total pour tout compte connecté) si l'appli se met à
-- refuser des données légitimes après supabase-rls-donnees-sensibles.sql.
DO $$
DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blessures','rpe','rpe_coach','footbar','suivi_poids','tests_physiques','commentaires_joueurs','forme_joueur'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_authenticated', t);
  END LOOP;
END $$;
