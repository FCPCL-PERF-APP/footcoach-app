-- À exécuter manuellement dans le SQL Editor de Supabase, uniquement si tu utilises
-- (ou comptes utiliser) le rôle "admin" pour un membre du staff.
--
-- Les policies RLS sur `staff` (voir supabase-rls-hardening.sql) ne vérifiaient que
-- role = 'coach' pour autoriser insert/update. Un membre "admin" (censé avoir un accès
-- complet équivalent au coach, voir src/pages/StaffPage.jsx) était donc bloqué par la
-- base de données même après la correction côté code (useAuth.jsx / api/_lib.js).

DROP POLICY IF EXISTS "staff_insert_coach_only" ON staff;
DROP POLICY IF EXISTS "staff_update_coach_only" ON staff;
DROP POLICY IF EXISTS "staff_delete_coach_only" ON staff;

CREATE POLICY "staff_insert_coach_only" ON staff
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach', 'admin'))
  );

CREATE POLICY "staff_update_coach_only" ON staff
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach', 'admin'))
  );

CREATE POLICY "staff_delete_coach_only" ON staff
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid() AND s.role IN ('coach', 'admin'))
  );
