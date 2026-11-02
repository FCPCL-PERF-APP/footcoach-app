# Sauvegarde de la base Supabase

Chaque nuit, GitHub (tâche « Sauvegarde de la base Supabase ») exporte toute la base,
la chiffre avec ta phrase de chiffrement et la garde **90 jours**.
Le dépôt étant public, les fichiers sont illisibles sans cette phrase.

## Ce qui est sauvegardé

- **Fichier `…-public.sql.gz.enc`** : toutes les tables de l'appli (joueurs, RPE, Footbar,
  blessures, stats, calendrier, messages…), avec les fonctions et les règles d'accès.
- **Fichier `…-auth.sql.gz.enc`** : les comptes de connexion (e-mails, mots de passe chiffrés).

**Non sauvegardé** : les fichiers déposés dans Supabase Storage (photos de joueurs,
ressources, images des messages). Seuls leurs liens sont dans la base.

## En cas d'échec

GitHub t'envoie un e-mail. Causes courantes :

- mot de passe de la base changé : mets à jour le secret `SUPABASE_DB_URL` ;
- projet Supabase en pause (projet gratuit inactif) : réactive-le depuis le tableau de bord.

## Récupérer une sauvegarde

1. GitHub > dépôt `footcoach-app` > **Actions** > **Sauvegarde de la base Supabase**.
2. Ouvre l'exécution de la date voulue. En bas de la page, télécharge l'artifact
   `sauvegarde-…`, puis double-clique le zip pour l'ouvrir.
3. Dans le Terminal, dans le dossier du projet :

   ```bash
   sh scripts/dechiffrer-sauvegarde.sh ~/Downloads/sauvegarde-XXXX/footcoach-AAAA-MM-JJ-public.sql.gz.enc
   ```

4. Tape ta phrase de chiffrement. Le fichier `.sql` lisible apparaît à côté.

## Restaurer

La restauration écrase des données. Ne la lance pas seul : demande à Claude de t'accompagner.
Le principe est le suivant :

- Pour **récupérer une table ou quelques lignes effacées par erreur**, on extrait les lignes
  concernées du fichier `.sql`, puis on les réinsère depuis le SQL Editor.
- Pour **repartir de zéro** (nouveau projet Supabase) :
  1. on charge `public.sql`, puis `auth.sql`, avec `psql` et la chaîne de connexion du nouveau projet ;
  2. on met à jour `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env` et dans Vercel.
