-- Liste des remplaçants (numéros 12 à 16) affichés sur l'onglet Compo, distincte de la
-- compo visuelle (compo_visuelle) qui ne doit contenir que les titulaires.
ALTER TABLE rapports_match ADD COLUMN IF NOT EXISTS banc jsonb;
