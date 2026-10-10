-- Capitaine désigné dans la compo (onglet Compo d'un match) — affiché sur le terrain,
-- dans le partage et dans l'export PDF.
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS capitaine_id text;
