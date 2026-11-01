#!/usr/bin/env bash
# Sets the MCP project's settings on Vercel and deploys it to production. Run from anywhere: ./apps/mcp/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

WEB_URL="${WEB_URL:-https://trycelia.vercel.app}"
# The Clerk production instance's Frontend API URL, such as https://clerk.example.org. There is no default: a development instance
# (a *.clerk.accounts.dev address) must never be the sign-in for production.
: "${AUTH_SERVER_URL:?Set AUTH_SERVER_URL to the Clerk production instance Frontend API URL}"
case "$AUTH_SERVER_URL" in
  *.clerk.accounts.dev*) echo "AUTH_SERVER_URL is a Clerk development instance. Use the production instance." >&2; exit 1 ;;
esac
MCP_PUBLIC_URL="${MCP_PUBLIC_URL:-https://mcp-trycelia.vercel.app/mcp}"

set_env() { printf %s "$2" | vercel env add "$1" production --project mcp --force; }

set_env AUTH_SERVER_URL "$AUTH_SERVER_URL"
set_env WEB_URL "$WEB_URL"
set_env MCP_PUBLIC_URL "$MCP_PUBLIC_URL"
vercel deploy --prod
