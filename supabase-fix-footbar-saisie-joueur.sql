-- Footbar saisi par les joueurs qui ne s'enregistre pas : même famille de problème que
-- rpe.type NOT NULL (cf. supabase-fix-rpe-type-notnull.sql). L'appli n'envoie que
-- evenement_id, joueur_id et les 8 mesures ; toute AUTRE colonne restée NOT NULL sans
-- valeur par défaut fait échouer l'INSERT à la première saisie sur un événement.
-- Script idempotent : sans effet sur ce qui est déjà correct.

-- 1. Les 8 colonnes de mesure existent (certaines n'avaient jamais été migrées)
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS distance_km decimal;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS sprint_max decimal;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS sprints integer;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS distance_hi decimal;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS temps_jeu integer;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS ballons_touches integer;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS nb_passes integer;
ALTER TABLE footbar ADD COLUMN IF NOT EXISTS nb_tirs integer;

-- 2. Retire NOT NULL de toute colonne non gérée par l'appli (hors clés et colonnes à défaut)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'footbar'
      AND is_nullable = 'NO' AND column_default IS NULL
      AND column_name NOT IN ('id', 'evenement_id', 'joueur_id')
  LOOP
    EXECUTE format('ALTER TABLE footbar ALTER COLUMN %I DROP NOT NULL', c.column_name);
    RAISE NOTICE 'NOT NULL retiré sur footbar.%', c.column_name;
  END LOOP;
END $$;

-- 3. Unicité (evenement_id, joueur_id) nécessaire à l'upsert, et accès authentifié
ALTER TABLE footbar DROP CONSTRAINT IF EXISTS footbar_evenement_joueur_unique;
ALTER TABLE footbar ADD CONSTRAINT footbar_evenement_joueur_unique UNIQUE (evenement_id, joueur_id);

ALTER TABLE footbar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "footbar_authenticated" ON footbar;
CREATE POLICY "footbar_authenticated" ON footbar FOR ALL TO authenticated USING (true) WITH CHECK (true);
