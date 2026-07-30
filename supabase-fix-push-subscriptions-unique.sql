-- L'activation des notifications (usePush.js) fait un upsert avec onConflict: 'user_id',
-- ce qui exige une contrainte UNIQUE (ou PRIMARY KEY) sur la colonne user_id pour
-- fonctionner en Postgres. Si cette contrainte n'a jamais existé (table créée à la main
-- très tôt dans le projet, avant que les migrations ne soient trackées ici), CHAQUE
-- upsert échoue silencieusement côté serveur — et comme le code ne vérifiait jusqu'ici
-- jamais l'erreur (corrigé dans le même commit), le bouton affichait "Activées" sans
-- qu'aucune ligne ne soit réellement enregistrée. Résultat : personne, y compris le
-- coach, n'a jamais reçu la moindre notification push depuis le lancement de la
-- fonctionnalité, malgré des activations répétées côté interface.
--
-- Dédoublonnage de sécurité avant d'ajouter la contrainte (garde la ligne la plus
-- récente par updated_at s'il existe malgré tout plusieurs lignes pour un même user_id).
DELETE FROM push_subscriptions a USING push_subscriptions b
  WHERE a.user_id = b.user_id AND a.updated_at < b.updated_at;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_unique UNIQUE (user_id);
