#!/usr/bin/env bash
# Quick start script for Medo — MBBS Student Blog & Study Notes Hub
set -e

PORT=${PORT:-8080}

echo "=================================================="
echo "🩺 Starting Medo — MBBS Student Blog & Notes Server..."
echo "=================================================="

python3 database.py
python3 server.py
