#!/bin/sh
# Déchiffre une sauvegarde téléchargée depuis GitHub (onglet Actions > artifact).
#   Base     : sh scripts/dechiffrer-sauvegarde.sh ~/Downloads/footcoach-AAAA-MM-JJ-public.sql.gz.enc
#              → un fichier .sql lisible à côté du fichier chiffré
#   Fichiers : sh scripts/dechiffrer-sauvegarde.sh ~/Downloads/footcoach-AAAA-MM-JJ-fichiers.tar.gz.enc
#              → un dossier avec les photos et ressources, à côté du fichier chiffré
# La phrase de chiffrement (BACKUP_PASSPHRASE) est demandée sans s'afficher.
set -eu
[ $# -eq 1 ] && [ -f "$1" ] || { echo "Usage : sh $0 fichier.sql.gz.enc | fichier.tar.gz.enc"; exit 1; }
printf "Phrase de chiffrement : "; stty -echo 2>/dev/null || true; read -r OPENSSL_PASS; stty echo 2>/dev/null || true; echo
export OPENSSL_PASS
umask 077
dechiffrer() { openssl enc -d -aes-256-cbc -md sha256 -pbkdf2 -iter 200000 -pass env:OPENSSL_PASS -in "$1" 2>/dev/null; }

case "$1" in
  *.tar.gz.enc)
    SORTIE="${1%.tar.gz.enc}"
    mkdir -p "$SORTIE"
    if ! dechiffrer "$1" | tar -xzf - -C "$SORTIE" 2>/dev/null; then
      rm -rf "$SORTIE"
      echo "Échec : phrase de chiffrement incorrecte ou fichier abîmé."
      exit 1
    fi
    echo "OK : $SORTIE ($(find "$SORTIE" -type f | wc -l | tr -d ' ') fichiers)"
    ;;
  *)
    SORTIE="${1%.gz.enc}"
    if ! dechiffrer "$1" | gunzip > "$SORTIE" 2>/dev/null; then
      rm -f "$SORTIE"
      echo "Échec : phrase de chiffrement incorrecte ou fichier abîmé."
      exit 1
    fi
    echo "OK : $SORTIE ($(grep -c '^COPY ' "$SORTIE") tables avec données)"
    ;;
esac
