-- Trace de dernière connexion pour le staff, sur le même principe que joueurs.last_seen
-- déjà utilisé par StatsConnexionPage.jsx. Sans cette colonne, l'appli ne pouvait pas
-- distinguer "compte créé" (dès l'envoi de l'invitation) de "s'est réellement connecté".
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_seen timestamptz;
