-- Durcissement RLS pour joueurs et messages — à exécuter manuellement dans le SQL
-- Editor de Supabase. Ces deux tables étaient explicitement listées comme "non
-- couvertes par un fichier .sql versionné, à vérifier manuellement" dans
-- supabase-rls-hardening.sql.
--
-- ÉTAPE 1 — Vérifie d'abord l'état actuel avant de modifier quoi que ce soit :
--
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where tablename in ('joueurs', 'messages');
--
-- Si les policies existantes sont déjà restrictives (pas de "USING (true)" ouvert
-- à tout le monde), inutile d'exécuter la suite. Si tu vois des policies avec
-- "true" en USING/WITH CHECK sans condition sur auth.uid(), applique ce qui suit.
--
-- Constaté le 2026-07-07 sur ce projet : policies "Allow all" (ALL, USING true)
-- sur joueurs et messages, plus une policy en double "Allow all joueurs" sur
-- joueurs. Accès total sans restriction — à corriger avec la suite du script.
--
-- ÉTAPE 2 — Remplace par des policies alignées sur le comportement réel de l'app
-- (vérifié dans le code : JoueursPage, MaFichePage, MessagesPage) :
--   - joueurs : lecture pour tout utilisateur connecté (staff + joueurs voient
--     l'effectif) ; écriture/suppression réservée coach/admin ; un joueur peut
--     modifier sa propre fiche (poids, bilan... via MaFichePage).
--   - messages : lecture des messages de groupe pour tous, des messages privés
--     seulement pour l'expéditeur/destinataire ; un utilisateur ne peut insérer
--     un message qu'en son propre nom ; suppression réservée à l'expéditeur ou
--     à un coach/admin (modération, cf. MessagesPage.jsx canDelete={isMe || isCoach}).
--
-- À tester après exécution : connexion coach + adjoint + joueur → effectif visible,
-- modification de sa propre fiche joueur, messagerie privée + groupe (lecture,
-- envoi, réaction, suppression).

-- ============================================================
-- JOUEURS
-- ============================================================
DROP POLICY IF EXISTS "Allow all" ON joueurs;
DROP POLICY IF EXISTS "Allow all joueurs" ON joueurs;

CREATE POLICY "joueurs_select_authenticated" ON joueurs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "joueurs_insert_coach_only" ON joueurs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach','admin'))
  );

CREATE POLICY "joueurs_update_coach_or_self" ON joueurs
  FOR UPDATE TO authenticated USING (
    auth_id = auth.uid()
    OR EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach','admin'))
  );

CREATE POLICY "joueurs_delete_coach_only" ON joueurs
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach','admin'))
  );

-- ============================================================
-- MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "Allow all" ON messages;

CREATE POLICY "messages_select_concerned" ON messages
  FOR SELECT TO authenticated USING (
    groupe = true OR expediteur_id = auth.uid() OR destinataire_id = auth.uid()
  );

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT TO authenticated WITH CHECK (expediteur_id = auth.uid());

CREATE POLICY "messages_update_concerned" ON messages
  FOR UPDATE TO authenticated USING (
    groupe = true OR expediteur_id = auth.uid() OR destinataire_id = auth.uid()
  );

CREATE POLICY "messages_delete_own_or_coach" ON messages
  FOR DELETE TO authenticated USING (
    expediteur_id = auth.uid()
    OR EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach','admin'))
  );
