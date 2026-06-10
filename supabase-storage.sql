-- Créer le bucket de stockage pour les ressources (PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ressources', 'ressources', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour permettre l'upload
CREATE POLICY IF NOT EXISTS "Allow upload ressources"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ressources');

-- Politique pour permettre la lecture publique
CREATE POLICY IF NOT EXISTS "Allow read ressources"
ON storage.objects FOR SELECT
USING (bucket_id = 'ressources');
