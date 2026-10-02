#!/usr/bin/env bash
# Publish a built frontend to S3 and refresh CloudFront (TICKET-018).
#
# Usage: scripts/deploy-frontend.sh <dist-dir> <bucket> <cloudfront-distribution-id>
#
# Order matters: hashed assets are uploaded before index.html, so a new index.html never
# references files that are not there yet. Old hashed assets are kept (not deleted), so browser
# tabs still running the previous release can lazy-load their chunks.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <dist-dir> <bucket> <cloudfront-distribution-id>" >&2
  exit 2
fi

readonly DIST_DIR="$1" BUCKET="$2" DISTRIBUTION_ID="$3"
readonly IMMUTABLE="public, max-age=31536000, immutable"
readonly NO_CACHE="no-cache"

if [[ ! -f "${DIST_DIR}/index.html" ]]; then
  echo "Error: ${DIST_DIR}/index.html not found. Build the frontend first." >&2
  exit 1
fi

if [[ -d "${DIST_DIR}/assets" ]]; then
  echo "Uploading hashed assets (immutable)..."
  aws s3 sync "${DIST_DIR}/assets" "s3://${BUCKET}/assets" --cache-control "${IMMUTABLE}" --only-show-errors
fi

echo "Uploading index.html and other files (no-cache)..."
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}" --exclude "assets/*" --delete --cache-control "${NO_CACHE}" --only-show-errors

echo "Invalidating CloudFront cache for / and /index.html..."
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/index.html" "/" --query "Invalidation.Id" --output text

echo "Frontend deployed."
