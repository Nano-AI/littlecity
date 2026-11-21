#!/bin/sh
# Build the game for https://littlecity.io/ and publish the built files (only)
# to the gh-pages branch of yaoderek/littlecity.io, the repo that serves the
# domain (its CNAME file is part of the build). Run from the repo root.
#
# The old address, https://yaoderek.github.io/littlecity/, is this repo's own
# gh-pages: a forwarding page that brings each player's towns along
# (tools/bridge, published once by tools/publish-bridge.sh). Do not publish
# the game there again: players' towns would stay behind at the old address.
set -e
ROOT=$(pwd)
OUT="$ROOT/.context/pages-dist"
SHA=$(git rev-parse --short HEAD)
SITE=yaoderek/littlecity.io
rm -rf "$OUT"
VITE_BUILD="$SHA" npx vite build --base=/ --outDir "$OUT" --emptyOutDir >/dev/null
touch "$OUT/.nojekyll"
echo littlecity.io > "$OUT/CNAME"
cd "$OUT"
git init -q -b gh-pages
git add -A
git commit -q -m "Publish Little City build from $SHA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q -f "https://github.com/$SITE.git" gh-pages
rm -rf "$OUT/.git"
# A forced push does not always start a Pages build; ask for one.
gh api -X POST "repos/$SITE/pages/builds" >/dev/null 2>&1 || true
echo "published $SHA to https://littlecity.io/"
