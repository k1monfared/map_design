#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building..."
npm run build

echo "Serving built output → http://localhost:4173/map_design/"
npm run preview
