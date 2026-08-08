-- Suivi live du match (remplace le carnet papier rempli en tribune) : croix de
-- placement sur le terrain, chronologie horodatée des événements, et notes de
-- mi-temps. Tout est rattaché à rapports_match, comme le reste du rapport de match.
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS terrain_marks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS chronologie jsonb DEFAULT '[]'::jsonb;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS recap_mi_temps text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS mt_axes_amelioration text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS mt_projection text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS mt_note_adjoint text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS notes_libres text;
