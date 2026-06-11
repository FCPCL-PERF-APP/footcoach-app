-- Bucket pour les photos joueurs
INSERT INTO storage.buckets (id, name, public)
VALUES ('joueurs', 'joueurs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Allow upload joueurs photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'joueurs');

CREATE POLICY IF NOT EXISTS "Allow read joueurs photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'joueurs');

CREATE POLICY IF NOT EXISTS "Allow update joueurs photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'joueurs');
