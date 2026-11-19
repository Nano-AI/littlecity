#!/bin/sh
# Build the game for https://yaoderek.github.io/littlecity/ and publish the
# built files (only) to the gh-pages branch. Run from the repo root.
set -e
ROOT=$(pwd)
OUT="$ROOT/.context/pages-dist"
SHA=$(git rev-parse --short HEAD)
REMOTE=$(git remote get-url origin)
rm -rf "$OUT"
npx vite build --base=/littlecity/ --outDir "$OUT" --emptyOutDir >/dev/null
touch "$OUT/.nojekyll"
cd "$OUT"
git init -q -b gh-pages
git add -A
git commit -q -m "Publish Little City build from $SHA

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
git push -q -f "$REMOTE" gh-pages
rm -rf "$OUT/.git"
# A forced push does not always start a Pages build; ask for one.
gh api -X POST repos/yaoderek/littlecity/pages/builds >/dev/null 2>&1 || true
echo "published $SHA to gh-pages"
