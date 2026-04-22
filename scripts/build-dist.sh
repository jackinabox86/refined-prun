#!/usr/bin/env bash
# Build the extension and package it as dist.zip at the repo root.
#
# The source woff2 fonts are tracked in Git LFS; when LFS is not installed
# the checkout contains tiny pointer files and the resulting dist serves
# corrupt fonts. We side-step that by restoring real binaries from
# patches/fonts/ before invoking vite.
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
    echo "build-dist: missing $src (did git lose the patches/fonts binaries?)" >&2
    exit 1
  fi
  # Replace only if the destination is an LFS pointer or otherwise differs.
  if ! cmp -s "$src" "$dst"; then
    cp "$src" "$dst"
    echo "build-dist: restored $dst from $src"
  fi
}

restore_font "fa-solid-900.woff2"
restore_font "fa-regular-400.woff2"

echo "build-dist: running pnpm build"
pnpm build

echo "build-dist: zipping dist -> dist.zip"
rm -f dist.zip
(cd dist && zip -r ../dist.zip . -q)
echo "build-dist: done ($(du -h dist.zip | cut -f1))"
