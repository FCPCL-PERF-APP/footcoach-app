-- Retour à l'état précédent : fiche joueur lisible/modifiable par tout compte connecté.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'joueurs' LOOP
    EXECUTE format('DROP POLICY %I ON joueurs', p.policyname);
  END LOOP;
END $$;
CREATE POLICY joueurs_authenticated ON joueurs FOR ALL TO authenticated USING (true) WITH CHECK (true);
