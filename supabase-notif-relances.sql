-- Trace les relances RPE déjà envoyées (une par joueur/événement), pour que le cron
-- (toutes les 15 min, fenêtre de 48h) arrête de renvoyer la même notification en boucle
-- tant que le joueur n'a pas rempli son RPE — jusqu'à ~190 pushes pour un seul événement
-- avant ce correctif.
CREATE TABLE IF NOT EXISTS notif_relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  joueur_id uuid NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'rpe',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evenement_id, joueur_id, type)
);

ALTER TABLE notif_relances ENABLE ROW LEVEL SECURITY;

-- Écriture/lecture réservées au service role (utilisé uniquement par le cron via
-- adminClient()) — aucun accès direct nécessaire depuis le navigateur.
DROP POLICY IF EXISTS "notif_relances_service_only" ON notif_relances;
CREATE POLICY "notif_relances_service_only" ON notif_relances
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
