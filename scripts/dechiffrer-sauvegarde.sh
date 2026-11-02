#!/bin/sh
# Déchiffre une sauvegarde téléchargée depuis GitHub (Actions > Sauvegarde de la base > artifact).
# Usage : sh scripts/dechiffrer-sauvegarde.sh ~/Downloads/footcoach-AAAA-MM-JJ-public.sql.gz.enc
# La phrase de chiffrement (BACKUP_PASSPHRASE) est demandée sans s'afficher.
# Résultat : un fichier .sql lisible à côté du fichier chiffré.
set -eu
[ $# -eq 1 ] && [ -f "$1" ] || { echo "Usage : sh $0 fichier.sql.gz.enc"; exit 1; }
SORTIE="${1%.gz.enc}"
printf "Phrase de chiffrement : "; stty -echo; read -r OPENSSL_PASS; stty echo; echo
export OPENSSL_PASS
umask 077
if ! openssl enc -d -aes-256-cbc -md sha256 -pbkdf2 -iter 200000 -pass env:OPENSSL_PASS -in "$1" 2>/dev/null | gunzip > "$SORTIE" 2>/dev/null; then
  rm -f "$SORTIE"
  echo "Échec : phrase de chiffrement incorrecte ou fichier abîmé."
  exit 1
fi
echo "OK : $SORTIE ($(grep -c '^COPY ' "$SORTIE") tables avec données)"
