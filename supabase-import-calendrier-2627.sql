-- Import du calendrier général saison 2026/2027, extrait depuis le fichier Excel du
-- coach ("Calendrier Général saison 26.27.xlsx") pour lui éviter une ressaisie
-- manuelle. Championnat/Coupe ne sont volontairement pas importés ici : ils sont déjà
-- recalculés automatiquement depuis les matchs existants dans l'Agenda (evenements).
INSERT INTO calendrier_jours (date_debut, date_fin, categorie, label) VALUES
  ('2026-10-17', '2026-10-31', 'vacances_scolaires', 'Vacances de la Toussaint'),
  ('2026-12-19', '2027-01-02', 'vacances_scolaires', 'Vacances de Noël'),
  ('2026-12-21', '2026-12-27', 'semaine_coupure',    NULL),
  ('2027-02-20', '2027-03-06', 'vacances_scolaires', 'Vacances d''hiver'),
  ('2027-03-29', '2027-03-29', 'jour_ferie',         'Lundi de Pâques'),
  ('2027-04-17', '2027-05-01', 'vacances_scolaires', 'Vacances de printemps'),
  ('2027-05-06', '2027-05-08', 'jour_ferie',         'Ascension + pont + 8 mai'),
  ('2027-05-17', '2027-05-17', 'jour_ferie',         'Lundi de Pentecôte');
