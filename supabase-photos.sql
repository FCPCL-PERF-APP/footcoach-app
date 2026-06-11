-- Bucket pour les photos joueurs
INSERT INTO storage.buckets (id, name, public)
VALUES ('joueurs', 'joueurs', true)
ON CONFLICT (id) DO NOTHING;

-- Supprimer les politiques si elles existent déjà
DROP POLICY IF EXISTS "Allow upload joueurs photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow read joueurs photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow update joueurs photos" ON storage.objects;

-- Recréer les politiques
CREATE POLICY "Allow upload joueurs photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'joueurs');

CREATE POLICY "Allow read joueurs photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'joueurs');

CREATE POLICY "Allow update joueurs photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'joueurs');

-- Colonne photo_url dans joueurs
ALTER TABLE joueurs ADD COLUMN IF NOT EXISTS photo_url text;
