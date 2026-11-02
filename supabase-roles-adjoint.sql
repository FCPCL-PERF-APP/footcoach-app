-- v361 — Rôle adjoint : « saisie et analyse ».
-- À exécuter dans le SQL Editor de Supabase (annulation : supabase-roles-adjoint-rollback.sql).
--
-- Les adjoints / préparateurs / gardiens gardent la saisie de toutes les données (fc_is_staff()).
-- Ce qui est réservé au coach principal et à l'admin dans l'appli l'est désormais aussi en base :
--   * création et suppression de joueurs ;
--   * archivage / réactivation d'un joueur (colonne joueurs.archive) ;
--   * archive de saison (table archives_saisons, lecture inchangée).
-- La gestion de la table staff était déjà réservée au coach/admin.

CREATE OR REPLACE FUNCTION public.fc_is_coach() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE auth_id = auth.uid() AND role IN ('coach', 'admin'))
$$;

-- Joueurs : création / suppression réservées au coach
DROP POLICY IF EXISTS joueurs_insert_staff ON joueurs;
DROP POLICY IF EXISTS joueurs_delete_staff ON joueurs;
DROP POLICY IF EXISTS joueurs_insert_coach ON joueurs;
DROP POLICY IF EXISTS joueurs_delete_coach ON joueurs;
CREATE POLICY joueurs_insert_coach ON joueurs FOR INSERT TO authenticated WITH CHECK (fc_is_coach());
CREATE POLICY joueurs_delete_coach ON joueurs FOR DELETE TO authenticated USING (fc_is_coach());

-- Joueurs : seul le coach peut archiver ou réactiver une fiche.
-- auth.uid() IS NULL = clé service (API serveur) ou SQL Editor : non concernés.
CREATE OR REPLACE FUNCTION public.joueurs_archive_coach_seul() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.archive IS DISTINCT FROM OLD.archive
     AND auth.uid() IS NOT NULL
     AND NOT fc_is_coach() THEN
    RAISE EXCEPTION 'Seul le coach principal peut archiver ou réactiver un joueur';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS joueurs_archive_coach_seul ON joueurs;
CREATE TRIGGER joueurs_archive_coach_seul BEFORE UPDATE ON joueurs
  FOR EACH ROW EXECUTE FUNCTION public.joueurs_archive_coach_seul();

-- Archive de saison : écriture réservée au coach (lecture : tout compte connecté, inchangée)
DROP POLICY IF EXISTS archives_saisons_write_staff ON archives_saisons;
DROP POLICY IF EXISTS archives_saisons_write_coach ON archives_saisons;
CREATE POLICY archives_saisons_write_coach ON archives_saisons FOR ALL TO authenticated
  USING (fc_is_coach()) WITH CHECK (fc_is_coach());

-- Vérification : doit lister joueurs_insert_coach, joueurs_delete_coach, archives_saisons_write_coach
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('joueurs', 'archives_saisons')
ORDER BY tablename, policyname;
