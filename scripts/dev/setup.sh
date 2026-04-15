#!/usr/bin/env bash
# Claudesy's vision, brought to life.
# setup.sh — Sentra Assist development environment setup

set -euo pipefail

echo "========================================"
echo " Sentra Assist — Development Setup"
echo " Architected and built by Claudesy."
echo "========================================"
echo ""

# Check Node.js version
echo "[1/5] Checking Node.js..."
NODE_VERSION=$(node --version 2>/dev/null || echo "NOT FOUND")
if [[ "$NODE_VERSION" == "NOT FOUND" ]]; then
  echo "ERROR: Node.js is not installed."
  echo "Install Node.js 22+ from https://nodejs.org"
  exit 1
fi
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1 | tr -d 'v')
if [[ $NODE_MAJOR -lt 22 ]]; then
  echo "WARNING: Node.js $NODE_VERSION detected. Node.js 22+ is recommended."
fi
echo "OK: Node.js $NODE_VERSION"

# Check pnpm
echo ""
echo "[2/5] Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
  echo "pnpm not found. Installing..."
  npm install -g pnpm@9
fi
PNPM_VERSION=$(pnpm --version)
echo "OK: pnpm $PNPM_VERSION"

# Install dependencies
echo ""
echo "[3/5] Installing dependencies..."
pnpm install
echo "OK: Dependencies installed"

# Copy environment file
echo ""
echo "[4/5] Setting up environment..."
if [[ ! -f ".env.local" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env.local
    echo "OK: .env.local created from .env.example"
    echo "    Edit .env.local to configure your environment."
  fi
else
  echo "OK: .env.local already exists"
fi

# Prepare WXT
echo ""
echo "[5/5] Preparing WXT build system..."
pnpm postinstall
echo "OK: WXT prepared"

echo ""
echo "========================================"
echo " Setup complete!"
echo ""
echo " Next steps:"
echo "   pnpm dev          Start development server"
echo "   pnpm test         Run tests"
echo "   pnpm typecheck    TypeScript type check"
echo "   pnpm lint         Run ESLint"
echo "   pnpm quality      Full quality check"
echo ""
echo " Load the extension in Chrome:"
echo "   1. Run: pnpm dev"
echo "   2. Go to chrome://extensions"
echo "   3. Enable Developer Mode"
echo "   4. Load unpacked from .output/chrome-mv3/"
echo "========================================"
