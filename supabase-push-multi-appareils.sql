-- Un abonnement push par APPAREIL (endpoint) et non plus un seul par utilisateur.
-- Avant : contrainte UNIQUE sur user_id => activer les notifications sur l'iPad
-- écrasait l'abonnement de l'iPhone (et inversement), qui cessait de recevoir quoi que
-- ce soit tout en continuant d'afficher "Activées".

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;

UPDATE push_subscriptions SET endpoint = subscription->>'endpoint' WHERE endpoint IS NULL;

-- Supprime toute contrainte UNIQUE portant uniquement sur user_id (quel que soit son nom)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'push_subscriptions' AND con.contype = 'u'
      AND (SELECT array_agg(att.attname::text) FROM unnest(con.conkey) k
           JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k) = ARRAY['user_id']
  LOOP
    EXECUTE format('ALTER TABLE push_subscriptions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Dédoublonnage de sécurité puis unicité par endpoint
DELETE FROM push_subscriptions a USING push_subscriptions b
  WHERE a.endpoint IS NOT NULL AND a.endpoint = b.endpoint AND a.created_at < b.created_at;

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_unique;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);
