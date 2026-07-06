-- Durcissement RLS — à exécuter manuellement dans le SQL Editor de Supabase.
-- Objectif : empêcher un accès direct aux tables via la clé anon (exposée dans le
-- bundle JS public) sans session utilisateur valide, et bloquer l'auto-promotion
-- coach via la table `staff`.
--
-- Portée : ne couvre que les tables dont une policy "USING (true)" a été retrouvée
-- dans les fichiers supabase-*.sql versionnés dans ce repo. Les tables suivantes
-- ne sont couvertes par AUCUN fichier .sql versionné et doivent être vérifiées
-- manuellement dans Supabase > Authentication > Policies avant d'être considérées
-- sûres : joueurs, evenements, messages, blessures, objectifs, objectifs_joueur,
-- onze_ideal, pronostics, forme_joueur, sondages, sondage_votes, cpa,
-- archives_saisons, badges, stats_match, rpe.
--
-- À tester juste après exécution : connexion coach + adjoint + joueur, création
-- staff, changement de rôle, saisie footbar/RPE, convocation, messagerie privée,
-- upload ressources — avant de considérer la migration comme validée.

-- ============================================================
-- 1. STAFF — faille de privilège la plus critique.
--    Avant : n'importe qui (même sans compte) pouvait s'insérer avec role='coach'.
--    Après : lecture réservée aux utilisateurs connectés, écriture réservée aux
--    coachs déjà existants.
-- ============================================================
DROP POLICY IF EXISTS "Allow read staff" ON staff;
DROP POLICY IF EXISTS "Allow update staff" ON staff;
DROP POLICY IF EXISTS "Allow insert staff" ON staff;

CREATE POLICY "staff_select_authenticated" ON staff
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff_insert_coach_only" ON staff
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role = 'coach')
  );

CREATE POLICY "staff_update_coach_only" ON staff
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role = 'coach')
  );

CREATE POLICY "staff_delete_coach_only" ON staff
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role = 'coach')
  );

-- ============================================================
-- 2. Tables ouvertes (USING true / WITH CHECK true) → restreintes aux
--    utilisateurs connectés (TO authenticated). Ne change pas la logique
--    métier existante (toujours "tout accès"), bloque juste l'accès anonyme
--    direct via la clé anon en dehors de l'app.
-- ============================================================
DROP POLICY IF EXISTS "Allow all footbar" ON footbar;
CREATE POLICY "footbar_authenticated" ON footbar FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all push" ON push_subscriptions;
CREATE POLICY "push_subscriptions_authenticated" ON push_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all convocations" ON convocations;
CREATE POLICY "convocations_authenticated" ON convocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all comments" ON commentaires_joueurs;
CREATE POLICY "commentaires_joueurs_authenticated" ON commentaires_joueurs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all tests" ON tests_physiques;
CREATE POLICY "tests_physiques_authenticated" ON tests_physiques FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all poids" ON suivi_poids;
CREATE POLICY "suivi_poids_authenticated" ON suivi_poids FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all rapports" ON rapports_match;
CREATE POLICY "rapports_match_authenticated" ON rapports_match FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all stats col" ON stats_collectives;
CREATE POLICY "stats_collectives_authenticated" ON stats_collectives FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all ressources" ON ressources;
CREATE POLICY "ressources_authenticated" ON ressources FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all presences" ON presences;
CREATE POLICY "presences_authenticated" ON presences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Storage — les buckets "joueurs" (photos) et "ressources" (PDFs) sont
--    en lecture/écriture publiques sans restriction. Idem : on restreint
--    l'upload/update aux utilisateurs connectés, la lecture reste publique
--    (nécessaire pour afficher photos/PDFs via URL directe dans l'app).
-- ============================================================
DROP POLICY IF EXISTS "Allow upload joueurs photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow update joueurs photos" ON storage.objects;
CREATE POLICY "joueurs_photos_upload_authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'joueurs');
CREATE POLICY "joueurs_photos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'joueurs');

DROP POLICY IF EXISTS "Allow upload ressources" ON storage.objects;
CREATE POLICY "ressources_upload_authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ressources');
