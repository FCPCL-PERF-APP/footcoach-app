-- Migration v2 — à exécuter dans Supabase SQL Editor

-- Ajouter heure et lieu de RDV aux événements
ALTER TABLE evenements ADD COLUMN IF NOT EXISTS rdv_heure text;
ALTER TABLE evenements ADD COLUMN IF NOT EXISTS rdv_lieu text;

-- Ajouter nom expéditeur aux messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expediteur_nom text;

-- Politique pour push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all push" ON push_subscriptions FOR ALL USING (true);

-- Politique pour convocations
ALTER TABLE convocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all convocations" ON convocations FOR ALL USING (true);

-- Politique pour commentaires joueurs
ALTER TABLE commentaires_joueurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all comments" ON commentaires_joueurs FOR ALL USING (true);

-- Politique pour tests physiques
ALTER TABLE tests_physiques ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all tests" ON tests_physiques FOR ALL USING (true);

-- Politique pour suivi poids
ALTER TABLE suivi_poids ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all poids" ON suivi_poids FOR ALL USING (true);

-- Politique pour rapports match
ALTER TABLE rapports_match ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all rapports" ON rapports_match FOR ALL USING (true);

-- Politique pour stats collectives
ALTER TABLE stats_collectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all stats col" ON stats_collectives FOR ALL USING (true);

-- Politique pour ressources
ALTER TABLE ressources ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all ressources" ON ressources FOR ALL USING (true);

-- Politique pour presences
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all presences" ON presences FOR ALL USING (true);

-- Politique pour staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow read staff" ON staff FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow update staff" ON staff FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow insert staff" ON staff FOR INSERT WITH CHECK (true);
