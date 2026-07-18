-- Contraintes d'unicité nécessaires pour pouvoir écrire ces tables en upsert() plutôt
-- qu'en delete()+insert() ou en "vérifier localement puis update/insert" — cette
-- dernière approche ne survit pas bien à une saisie hors connexion (pas de garantie
-- que l'état local soit à jour une fois la synchro relancée) ni à une coupure réseau
-- en plein milieu de la sauvegarde (cf. correctifs v243 sur presences/convocations).
--
-- Avant chaque contrainte : déduplication défensive, car l'ancien pattern delete+insert
-- (et les échecs partiels qu'il pouvait provoquer avant v243) a pu laisser des doublons
-- (evenement_id, joueur_id) en base — une contrainte UNIQUE échouerait sinon à la
-- création. On garde la ligne la plus récente de chaque doublon.

DELETE FROM stats_match a USING stats_match b
  WHERE a.id < b.id AND a.evenement_id = b.evenement_id AND a.joueur_id = b.joueur_id;
ALTER TABLE stats_match DROP CONSTRAINT IF EXISTS stats_match_evenement_joueur_unique;
ALTER TABLE stats_match ADD CONSTRAINT stats_match_evenement_joueur_unique
  UNIQUE (evenement_id, joueur_id);

DELETE FROM stats_collectives a USING stats_collectives b
  WHERE a.id < b.id AND a.evenement_id = b.evenement_id;
ALTER TABLE stats_collectives DROP CONSTRAINT IF EXISTS stats_collectives_evenement_unique;
ALTER TABLE stats_collectives ADD CONSTRAINT stats_collectives_evenement_unique
  UNIQUE (evenement_id);

DELETE FROM rapports_match a USING rapports_match b
  WHERE a.id < b.id AND a.evenement_id = b.evenement_id;
ALTER TABLE rapports_match DROP CONSTRAINT IF EXISTS rapports_match_evenement_unique;
ALTER TABLE rapports_match ADD CONSTRAINT rapports_match_evenement_unique
  UNIQUE (evenement_id);

DELETE FROM convocations a USING convocations b
  WHERE a.id < b.id AND a.evenement_id = b.evenement_id AND a.joueur_id = b.joueur_id;
ALTER TABLE convocations DROP CONSTRAINT IF EXISTS convocations_evenement_joueur_unique;
ALTER TABLE convocations ADD CONSTRAINT convocations_evenement_joueur_unique
  UNIQUE (evenement_id, joueur_id);

DELETE FROM presences a USING presences b
  WHERE a.id < b.id AND a.evenement_id = b.evenement_id AND a.joueur_id = b.joueur_id;
ALTER TABLE presences DROP CONSTRAINT IF EXISTS presences_evenement_joueur_unique;
ALTER TABLE presences ADD CONSTRAINT presences_evenement_joueur_unique
  UNIQUE (evenement_id, joueur_id);

-- Motif optionnel associé à une présence (surtout utile pour "absent" : distinguer une
-- absence justifiée d'un désengagement, sans avoir à fouiller dans les messages).
ALTER TABLE presences ADD COLUMN IF NOT EXISTS motif text;
