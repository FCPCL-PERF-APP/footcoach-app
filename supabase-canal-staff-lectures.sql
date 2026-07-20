-- 1. Canal staff — les messages du canal groupe existant deviennent le canal
--    "general" (tout le monde), et un nouveau canal "staff" n'est visible que du
--    staff (coach/adjoint/préparateur/gardien), avec une vraie restriction en base
--    (pas seulement cachée dans l'interface) pour qu'un joueur ne puisse pas y
--    accéder même en interrogeant directement l'API Supabase.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'general';

DROP POLICY IF EXISTS "messages_select_concerned" ON messages;
CREATE POLICY "messages_select_concerned" ON messages
  FOR SELECT TO authenticated USING (
    (groupe = true AND canal = 'general')
    OR (groupe = true AND canal = 'staff' AND EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid()))
    OR expediteur_id = auth.uid()
    OR destinataire_id = auth.uid()
  );

DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT TO authenticated WITH CHECK (
    expediteur_id = auth.uid()
    AND (canal != 'staff' OR EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid()))
  );

DROP POLICY IF EXISTS "messages_update_concerned" ON messages;
CREATE POLICY "messages_update_concerned" ON messages
  FOR UPDATE TO authenticated USING (
    (groupe = true AND canal = 'general')
    OR (groupe = true AND canal = 'staff' AND EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid()))
    OR expediteur_id = auth.uid()
    OR destinataire_id = auth.uid()
  );

-- 2. Suivi de lecture par canal — permet au coach de voir qui a vu les messages du
--    canal groupe général, sans que les joueurs voient ce suivi entre eux (seul le
--    coach/admin peut lire les lignes des autres ; chacun ne peut écrire que la sienne).
CREATE TABLE IF NOT EXISTS message_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canal text NOT NULL,
  derniere_lecture timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, canal)
);

ALTER TABLE message_lectures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_lectures_insert_own" ON message_lectures;
CREATE POLICY "message_lectures_insert_own" ON message_lectures
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "message_lectures_update_own" ON message_lectures;
CREATE POLICY "message_lectures_update_own" ON message_lectures
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "message_lectures_select" ON message_lectures;
CREATE POLICY "message_lectures_select" ON message_lectures
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach','admin'))
  );
