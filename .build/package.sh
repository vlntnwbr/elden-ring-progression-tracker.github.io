#!/bin/bash
set -e

EXCLUDE_FILES=(
    --exclude='./.*'
    --exclude='./doc'
    --exclude='./README.md'
    --exclude=nginx.conf
    --exclude="*.sh"
)

VERSION=$(sed -n '1,5s/.*major: \([0-9]*\), minor: \([0-9]*\), patch: \([0-9]*\).*/\1.\2.\3/p' index.js)

case "$1" in
    github)
        [[ -z "$2" ]] && { echo "error: archive destination undefined." >&2; exit 1; }
        DEST="$2"
        ;;
    *)
        DEST=".build/elden-ring-progression-tracker-${VERSION}.tar.gz"
        [[ -e "$DEST" ]] && { echo "Error: $DEST already exists." >&2; exit 1; }
        ;;
esac

mkdir -p "$(dirname "$DEST")"

printf '%s\n' "$VERSION" > VERSION
trap 'rm -f VERSION' EXIT

tar "${EXCLUDE_FILES[@]}" -czvf "$DEST" .