-- Durcissement des messages. État vérifié dans les fichiers versionnés : la LECTURE est déjà
-- correcte (un message privé n'est lisible que par son expéditeur et son destinataire ; le canal
-- staff que par le staff). Restent deux failles d'ÉCRITURE, corrigées ici par des triggers :
--  1. Modification : tout compte connecté pouvait modifier le CONTENU de n'importe quel message
--     de groupe (la policy UPDATE existe pour les réactions et le « lu »). Désormais, un compte
--     qui n'est pas l'expéditeur ne peut changer QUE `reactions` et `lu`.
--  2. Usurpation : à l'envoi, nom et rôle de l'expéditeur étaient pris tels quels depuis le client
--     (un joueur pouvait signer « Coach »). Ils sont maintenant recalculés côté base.
-- Les appels serveur (clé service : notifications, crons) ne sont pas concernés.

-- 1. Seuls réactions et « lu » modifiables par un non-expéditeur
CREATE OR REPLACE FUNCTION public.messages_limite_modification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.expediteur_id IS DISTINCT FROM auth.uid() THEN
    IF (to_jsonb(NEW) - 'reactions' - 'lu') IS DISTINCT FROM (to_jsonb(OLD) - 'reactions' - 'lu') THEN
      RAISE EXCEPTION 'Seules les réactions et le statut « lu » peuvent être modifiés sur le message d''un autre.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messages_limite_modification ON messages;
CREATE TRIGGER messages_limite_modification BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_limite_modification();

-- 2. Nom et rôle de l'expéditeur recalculés depuis staff / joueurs
CREATE OR REPLACE FUNCTION public.messages_expediteur_fiable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text; r text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')), role INTO n, r
    FROM staff WHERE auth_id = NEW.expediteur_id LIMIT 1;
  IF FOUND THEN
    NEW.expediteur_nom := n; NEW.expediteur_role := r;
  ELSE
    SELECT trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')) INTO n
      FROM joueurs WHERE auth_id = NEW.expediteur_id LIMIT 1;
    IF FOUND THEN NEW.expediteur_nom := n; NEW.expediteur_role := 'joueur'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messages_expediteur_fiable ON messages;
CREATE TRIGGER messages_expediteur_fiable BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_expediteur_fiable();
