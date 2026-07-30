-- Diagnostic temporaire : liste les vraies colonnes de push_subscriptions (ne modifie
-- rien). L'upsert échoue avec "could not find the 'auth' column" — le nom réel diffère
-- probablement de celui utilisé dans le code (usePush.js).
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'push_subscriptions'
ORDER BY ordinal_position;
