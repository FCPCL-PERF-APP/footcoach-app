-- Protection de la table joueurs (e-mail, date de naissance, coordonnées...).
-- Avant : tout compte connecté (même un joueur) pouvait lire la fiche complète de tous les joueurs.
-- Après :
--   * table joueurs : staff = tout ; un joueur = sa propre fiche uniquement
--   * vue joueurs_equipe : nom, prénom, poste, numéro, photo, pôle, archive, auth_id — lisible par
--     tous les comptes connectés (messagerie, convocations visibles, jeux...), sans données personnelles
-- À lancer APRÈS le déploiement de la version de l'appli qui lit cette vue (v356).
-- Rollback : supabase-rls-joueurs-rollback.sql

CREATE OR REPLACE FUNCTION public.fc_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE auth_id = auth.uid())
$$;

-- Vue publique de l'effectif (s'exécute avec les droits de son propriétaire : contourne le RLS
-- de joueurs, uniquement pour ces colonnes)
CREATE OR REPLACE VIEW public.joueurs_equipe AS
  SELECT id, nom, prenom, poste, numero, photo_url, groupe, archive, auth_id FROM public.joueurs;
REVOKE ALL ON public.joueurs_equipe FROM anon, public;
GRANT SELECT ON public.joueurs_equipe TO authenticated;

ALTER TABLE joueurs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'joueurs' LOOP
    EXECUTE format('DROP POLICY %I ON joueurs', p.policyname);
  END LOOP;
END $$;

-- Lecture : staff, le joueur lui-même, ou une fiche pas encore reliée dont l'e-mail correspond
-- à la personne qui se connecte (premier accès : useAuth relie alors le compte à la fiche)
CREATE POLICY joueurs_select ON joueurs FOR SELECT TO authenticated
  USING (
    fc_is_staff()
    OR auth_id = auth.uid()
    OR (auth_id IS NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
  );

-- Modification : staff, ou le joueur sur sa propre fiche (profil, photo, onboarding) ;
-- une fiche archivée ne peut plus être reliée par e-mail
CREATE POLICY joueurs_update ON joueurs FOR UPDATE TO authenticated
  USING (
    fc_is_staff()
    OR auth_id = auth.uid()
    OR (auth_id IS NULL AND archive = false AND lower(email) = lower(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    fc_is_staff()
    OR auth_id = auth.uid()
  );

-- Création / suppression : staff uniquement
CREATE POLICY joueurs_insert_staff ON joueurs FOR INSERT TO authenticated WITH CHECK (fc_is_staff());
CREATE POLICY joueurs_delete_staff ON joueurs FOR DELETE TO authenticated USING (fc_is_staff());
