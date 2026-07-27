-- Les tables cpa et sondages ont été sécurisées manuellement dans Supabase (voir
-- supabase-rls-hardening.sql, ligne "à sécuriser manuellement... cpa" côté sondages/cpa)
-- avec des policies écriture réservées au coach. Le code applicatif autorise désormais
-- tout le staff (adjoint/éducateur/préparateur/gardien, pas seulement coach/admin) à
-- créer/modifier/supprimer des schémas CPA et des sondages — ces policies suivent.
--
-- Comme plusieurs policies pour une même action sont combinées en OR par Postgres,
-- ce script ajoute simplement des policies "staff" en complément : elles élargissent
-- l'accès sans jamais le restreindre, quelle que soit la policy déjà en place.

DROP POLICY IF EXISTS "cpa_insert_staff" ON cpa;
CREATE POLICY "cpa_insert_staff" ON cpa
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "cpa_update_staff" ON cpa;
CREATE POLICY "cpa_update_staff" ON cpa
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "cpa_delete_staff" ON cpa;
CREATE POLICY "cpa_delete_staff" ON cpa
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "sondages_insert_staff" ON sondages;
CREATE POLICY "sondages_insert_staff" ON sondages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "sondages_update_staff" ON sondages;
CREATE POLICY "sondages_update_staff" ON sondages
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.auth_id = auth.uid())
  );
