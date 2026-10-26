-- Archivage d'un joueur qui quitte l'effectif : on garde toutes ses données (stats, RPE,
-- présences...) pour le retrouver plus tard, mais il disparaît des listes actives et perd
-- l'accès à l'appli (auth_id retiré). Il le retrouve si le coach le réactive / lui renvoie
-- une invitation.
ALTER TABLE joueurs ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false;
ALTER TABLE joueurs ADD COLUMN IF NOT EXISTS archive_le timestamptz;
