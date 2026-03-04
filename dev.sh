#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting dev server → http://localhost:5173/map_design/"
npm run dev
