#!/bin/bash
EXCLUDE_FILES=(
    --exclude='./.*'
    --exclude='./doc'
    --exclude='./README.md'
    --exclude=nginx.conf
    --exclude="*.sh"
)

case "$1" in
    github)
        tar "${EXCLUDE_FILES[@]}" -czvf "elden-ring-progression-tracker.tar.gz" .
        ;;
    *)
        VERSION=$(sed -n '1,5s/.*major: \([0-9]*\), minor: \([0-9]*\), patch: \([0-9]*\).*/\1.\2.\3/p' index.js)
        DEST=".build/elden-ring-progression-tracker-${VERSION}.tar.gz"
        [[ -e "$DEST" ]] && { echo "Error: $DEST already exists." >&2; exit 1; }
        mkdir -p "$(dirname "$DEST")"
        tar "${EXCLUDE_FILES[@]}" -czvf "$DEST" .
        ;;
esac
