-- Import du calendrier Championnat Régional 3 / Poule G 2026-2027 pour Plouagat Chat
-- Lan Fc, extrait du PDF officiel de la Ligue Bretagne de Football
-- ("Calendriers-R3-2026-2027.pdf"). RDV et lieu laissés vides — à compléter match par
-- match dans l'appli selon la logistique de chaque déplacement.
INSERT INTO evenements (type, titre, date_heure, domicile, match_type) VALUES
  ('match', 'vs Pont. Ent Trieux Fc',  '2026-09-06T15:30:00', true,  'championnat'),
  ('match', 'vs Rospez Cs',            '2026-09-20T15:30:00', false, 'championnat'),
  ('match', 'vs St Agathon Es',        '2026-10-04T15:30:00', true,  'championnat'),
  ('match', 'vs Trebeurden Pleum Fc',  '2026-10-18T15:30:00', false, 'championnat'),
  ('match', 'vs Begard Cs',            '2026-10-25T15:30:00', true,  'championnat'),
  ('match', 'vs Lannion Fc 3',         '2026-11-08T13:00:00', false, 'championnat'),
  ('match', 'vs Perros Louannec Us',   '2026-11-22T15:00:00', true,  'championnat'),
  ('match', 'vs Lanvollon Js',         '2026-11-29T15:00:00', true,  'championnat'),
  ('match', 'vs Treguier Tregor Fc',   '2026-12-06T15:00:00', false, 'championnat'),
  ('match', 'vs Cavan Js',             '2026-12-13T15:00:00', true,  'championnat'),
  ('match', 'vs Lannion Servel As',    '2027-01-31T15:00:00', false, 'championnat'),
  ('match', 'vs Rospez Cs',            '2027-02-14T15:00:00', true,  'championnat'),
  ('match', 'vs St Agathon Es',        '2027-02-21T15:30:00', false, 'championnat'),
  ('match', 'vs Trebeurden Pleum Fc',  '2027-03-14T15:30:00', true,  'championnat'),
  ('match', 'vs Begard Cs',            '2027-03-21T15:30:00', false, 'championnat'),
  ('match', 'vs Lannion Fc 3',         '2027-04-04T15:30:00', true,  'championnat'),
  ('match', 'vs Perros Louannec Us',   '2027-04-11T15:30:00', false, 'championnat'),
  ('match', 'vs Lanvollon Js',         '2027-04-18T15:30:00', false, 'championnat'),
  ('match', 'vs Treguier Tregor Fc',   '2027-04-25T15:30:00', true,  'championnat'),
  ('match', 'vs Cavan Js',             '2027-05-02T15:30:00', false, 'championnat'),
  ('match', 'vs Lannion Servel As',    '2027-05-23T15:30:00', true,  'championnat'),
  ('match', 'vs Pont. Ent Trieux Fc',  '2027-05-30T15:30:00', false, 'championnat');
