#!/bin/sh
# Build the Agent Plugins ZIP for the OpenAI plugin directory upload.
# Cursor and other Agent Plugins clients read the same files straight from this repo.
set -e
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/skillselion-plugin.zip
zip -q -X dist/skillselion-plugin.zip plugin.json mcp.json assets/logo.png assets/icon.png
echo "dist/skillselion-plugin.zip"
