#!/usr/bin/env bash
# Sets the MCP project's settings on Vercel and deploys it to production. Run from anywhere: ./apps/mcp/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

WEB_URL="${WEB_URL:-https://trycelia.vercel.app}"
AUTH_SERVER_URL="${AUTH_SERVER_URL:-https://becoming-marmoset-801.clerk.accounts.dev}"
MCP_PUBLIC_URL="${MCP_PUBLIC_URL:-https://mcp-trycelia.vercel.app/mcp}"

set_env() { printf %s "$2" | vercel env add "$1" production --project mcp --force; }

set_env AUTH_SERVER_URL "$AUTH_SERVER_URL"
set_env WEB_URL "$WEB_URL"
set_env MCP_PUBLIC_URL "$MCP_PUBLIC_URL"
vercel deploy --prod
