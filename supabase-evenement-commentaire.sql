-- Commentaire libre du coach sur un match (terrain synthétique, RDV sur place pour
-- ceux qui viennent directement...) — visible par tous sur la carte du match dans
-- l'agenda, éditable uniquement par le coach via le formulaire de modification.
ALTER TABLE evenements ADD COLUMN IF NOT EXISTS commentaire text;
