#!/bin/sh
# Packs the project source (without dependencies or build output) into
# public/ so the build serves it as a downloadable archive. Preview-only.
set -e
tar -czf /tmp/madebygio-source.tgz \
  --exclude=./node_modules --exclude=./dist --exclude=./.vercel \
  --exclude=./test-results --exclude='./hosted-projects/*/node_modules' .
mv /tmp/madebygio-source.tgz public/madebygio-source.tgz
