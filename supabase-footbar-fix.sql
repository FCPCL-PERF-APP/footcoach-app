-- Ajouter une contrainte unique sur footbar pour éviter les doublons
ALTER TABLE footbar DROP CONSTRAINT IF EXISTS footbar_evenement_joueur_unique;
ALTER TABLE footbar ADD CONSTRAINT footbar_evenement_joueur_unique 
  UNIQUE (evenement_id, joueur_id);

-- Idem pour RPE
ALTER TABLE rpe DROP CONSTRAINT IF EXISTS rpe_evenement_joueur_unique;
ALTER TABLE rpe ADD CONSTRAINT rpe_evenement_joueur_unique 
  UNIQUE (evenement_id, joueur_id);

-- Activer RLS sur footbar
ALTER TABLE footbar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all footbar" ON footbar;
CREATE POLICY "Allow all footbar" ON footbar FOR ALL USING (true) WITH CHECK (true);
