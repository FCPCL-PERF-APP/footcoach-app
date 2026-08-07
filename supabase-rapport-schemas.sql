-- Le rapport de match (table rapports_match) passe au support des schémas tactiques
-- (photos de slides PowerPoint exportées en image) en complément du texte, pour les
-- animations offensive/défensive, les CPA (corners pour/contre, CPA à l'intérieur) et
-- la composition adverse. Les images sont uploadées dans le bucket Storage "joueurs"
-- (déjà utilisé pour les photos de messagerie) et seule l'URL publique est stockée ici.
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS schema_animation_offensive text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS schema_animation_defensive text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS schema_cpa_corner_pour text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS schema_cpa_corner_contre text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS schema_cpa_interieur text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS schema_compo_adverse text;
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS joueurs_a_surveiller text;
