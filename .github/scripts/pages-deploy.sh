#!/usr/bin/env bash
# Deploys web/dist to Cloudflare Pages with Wrangler (decision D-035).
#   .github/scripts/pages-deploy.sh <branch>
# "main" is the production deployment; any other branch gets a preview URL.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
# The first run creates the Pages project.
set -euo pipefail

branch="$1"
wrangler_version="4.158.0"
export WRANGLER_SEND_METRICS=false
project="$(node --input-type=module -e "import { site } from './config/site.ts'; console.log(site.pagesProject)")"
wrangler() { pnpm dlx "wrangler@${wrangler_version}" "$@"; }

if ! output="$(wrangler pages project create "$project" --production-branch main 2>&1)"; then
  if ! grep -qi 'already exists' <<<"$output"; then
    echo "$output"
    exit 1
  fi
fi

wrangler pages deploy web/dist --project-name "$project" --branch "$branch" | tee .daily-deploy.log
urls="$(grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev' .daily-deploy.log | sort -u || true)"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Cloudflare Pages ($branch)"
    echo
    for url in $urls; do echo "- $url"; done
  } >>"$GITHUB_STEP_SUMMARY"
fi
rm -f .daily-deploy.log
