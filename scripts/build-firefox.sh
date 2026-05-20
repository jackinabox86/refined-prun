#!/usr/bin/env bash
# Build the extension and package it as a Firefox-ready .xpi at the repo root.
#
# Usage: bash scripts/build-firefox.sh
# Output: refined-prun-VERSION.xpi
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fonts_src="patches/fonts"
fonts_dst="src/assets/fonts"

restore_font() {
  local name="$1"
  local src="$fonts_src/$name"
  local dst="$fonts_dst/$name"
  if [[ ! -f "$src" ]]; then
    echo "build-firefox: missing $src (did git lose the patches/fonts binaries?)" >&2
    exit 1
  fi
  if ! cmp -s "$src" "$dst"; then
    cp "$src" "$dst"
    echo "build-firefox: restored $dst from $src"
  fi
}

cleanup_fonts() {
  git checkout -- \
    "$fonts_dst/fa-solid-900.woff2" \
    "$fonts_dst/fa-regular-400.woff2" 2>/dev/null || true
}
trap cleanup_fonts EXIT

restore_font "fa-solid-900.woff2"
restore_font "fa-regular-400.woff2"

echo "build-firefox: running pnpm build"
pnpm build

version="$(cat VERSION)"
npx dot-json@1 dist/manifest.json version "$version"
xpi_name="refined-prun-${version}.xpi"

echo "build-firefox: packaging dist -> ${xpi_name}"
rm -f "${xpi_name}"
(cd dist && zip -r "../${xpi_name}" . -q)
echo "build-firefox: done ($(du -h "${xpi_name}" | cut -f1))"
echo "build-firefox: output -> ${xpi_name}"
