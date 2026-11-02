-- Annule supabase-roles-adjoint.sql (retour aux droits « tout le staff »).

DROP TRIGGER IF EXISTS joueurs_archive_coach_seul ON joueurs;
DROP FUNCTION IF EXISTS public.joueurs_archive_coach_seul();

DROP POLICY IF EXISTS joueurs_insert_coach ON joueurs;
DROP POLICY IF EXISTS joueurs_delete_coach ON joueurs;
CREATE POLICY joueurs_insert_staff ON joueurs FOR INSERT TO authenticated WITH CHECK (fc_is_staff());
CREATE POLICY joueurs_delete_staff ON joueurs FOR DELETE TO authenticated USING (fc_is_staff());

DROP POLICY IF EXISTS archives_saisons_write_coach ON archives_saisons;
CREATE POLICY archives_saisons_write_staff ON archives_saisons FOR ALL TO authenticated
  USING (fc_is_staff()) WITH CHECK (fc_is_staff());

-- fc_is_coach() est conservée (sans effet si plus rien ne l'utilise).
