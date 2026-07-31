-- Permet de joindre une photo à un message (groupe, canal staff, ou privé).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url text;
