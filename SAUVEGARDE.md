# Sauvegarde de la base Supabase

Deux tâches GitHub chiffrent tout avec ta phrase de chiffrement et gardent chaque copie **90 jours** :

- **chaque nuit**, « Sauvegarde de la base Supabase » exporte toute la base ;
- **chaque dimanche**, « Sauvegarde des fichiers Supabase » copie toutes les photos et ressources.

Le dépôt étant public, les fichiers sont illisibles sans cette phrase.

## Ce qui est sauvegardé

- **Fichier `…-public.sql.gz.enc`** : toutes les tables de l'appli (joueurs, RPE, Footbar,
  blessures, stats, calendrier, messages…), avec les fonctions et les règles d'accès.
- **Fichier `…-auth.sql.gz.enc`** : les comptes de connexion (e-mails, mots de passe chiffrés).

- **Fichier `…-fichiers.tar.gz.enc`** (le dimanche) : tous les fichiers de Supabase Storage,
  espaces `joueurs` (photos joueurs et staff, images) et `ressources` (documents partagés).

## En cas d'échec

GitHub t'envoie un e-mail. Causes courantes :

- mot de passe de la base changé : mets à jour le secret `SUPABASE_DB_URL` ;
- clé de service Supabase régénérée : mets à jour le secret `SUPABASE_SERVICE_KEY` ;
- projet Supabase en pause (projet gratuit inactif) : réactive-le depuis le tableau de bord.

## Récupérer une sauvegarde

1. GitHub > dépôt `footcoach-app` > **Actions** > **Sauvegarde de la base Supabase**
   (ou **Sauvegarde des fichiers Supabase**).
2. Ouvre l'exécution de la date voulue. En bas de la page, télécharge l'artifact
   `sauvegarde-…`, puis double-clique le zip pour l'ouvrir.
3. Dans le Terminal, dans le dossier du projet :

   ```bash
   sh scripts/dechiffrer-sauvegarde.sh ~/Downloads/sauvegarde-XXXX/footcoach-AAAA-MM-JJ-public.sql.gz.enc
   ```

4. Tape ta phrase de chiffrement. Le fichier `.sql` lisible apparaît à côté.
   Pour les fichiers, même commande sur `footcoach-…-fichiers.tar.gz.enc` : un dossier
   avec les photos et documents apparaît à côté.

## Restaurer

La restauration écrase des données. Ne la lance pas seul : demande à Claude de t'accompagner.
Le principe est le suivant :

- Pour **récupérer une table ou quelques lignes effacées par erreur**, on extrait les lignes
  concernées du fichier `.sql`, puis on les réinsère depuis le SQL Editor.
- Pour **repartir de zéro** (nouveau projet Supabase) :
  1. on charge `public.sql`, puis `auth.sql`, avec `psql` et la chaîne de connexion du nouveau projet ;
  2. on met à jour `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env` et dans Vercel.
