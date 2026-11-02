-- Mesure d'usage : quelles pages sont ouvertes, par qui (rôle) et quand.
-- Aucune donnée de contenu, seulement le chemin de la page (identifiants remplacés par :id).
CREATE TABLE IF NOT EXISTS page_vues (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL,
  path text NOT NULL CHECK (char_length(path) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_vues_created_idx ON page_vues (created_at);

ALTER TABLE page_vues ENABLE ROW LEVEL SECURITY;
-- Chacun peut enregistrer ses propres ouvertures ; personne ne lit la table directement.
DROP POLICY IF EXISTS page_vues_insert_soi ON page_vues;
CREATE POLICY page_vues_insert_soi ON page_vues FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Synthèse réservée au coach principal : ouvertures et personnes distinctes par page.
CREATE OR REPLACE FUNCTION public.fc_pages_vues(jours int DEFAULT 30)
RETURNS TABLE (path text, groupe text, ouvertures bigint, personnes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.path,
         CASE WHEN v.role = 'joueur' THEN 'joueur' ELSE 'staff' END AS groupe,
         count(*) AS ouvertures,
         count(DISTINCT v.user_id) AS personnes
  FROM page_vues v
  WHERE fc_is_coach() AND v.created_at >= now() - make_interval(days => jours)
  GROUP BY 1, 2
  ORDER BY 3 DESC
$$;
REVOKE ALL ON FUNCTION public.fc_pages_vues(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fc_pages_vues(int) TO authenticated;

-- Vérification : doit afficher 1 ligne (page_vues_insert_soi)
SELECT policyname FROM pg_policies WHERE tablename = 'page_vues';
