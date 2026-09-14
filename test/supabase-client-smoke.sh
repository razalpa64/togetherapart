#!/usr/bin/env bash
# Smoke test for the Supabase client backend (public/js/backend/supabase.js).
# Rewrites its imports to local mocks (Node can't resolve '/vendor/supabase.js'),
# then exercises the route table: provider installation, RPC passthrough,
# table traces (update/eq/is), validation errors, the planner, signed URLs,
# and the realtime connect/send/disconnect lifecycle.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$DIR/mocks/mock-supabase.mjs" "$WORK/mock-supabase.mjs"
cp "$DIR/mocks/mock-bus.mjs"      "$WORK/mock-bus.mjs"
cp "$DIR/mocks/mock-api.mjs"      "$WORK/mock-api.mjs"
cp "$DIR/mocks/mock-ws.mjs"       "$WORK/mock-ws.mjs"
cp "$DIR/mocks/mock-state.mjs"    "$WORK/mock-state.mjs"
cp "$DIR/supabase-client-smoke.mjs" "$WORK/run.mjs"

cp "$DIR/../public/js/backend/supabase.js" "$WORK/facade.mjs"
cp "$DIR/../public/js/content/decks.js"    "$WORK/mock-decks.mjs"
cp "$DIR/../public/js/content/planner.js"  "$WORK/mock-planner.mjs"
sed -i.bak -e "s#from '/vendor/supabase.js'#from './mock-supabase.mjs'#" \
           -e "s#from '../bus.js'#from './mock-bus.mjs'#" \
           -e "s#from '../api.js'#from './mock-api.mjs'#" \
           -e "s#from '../ws.js'#from './mock-ws.mjs'#" \
           -e "s#from '../state.js'#from './mock-state.mjs'#" \
           -e "s#from '../content/decks.js'#from './mock-decks.mjs'#" \
           -e "s#from '../content/planner.js'#from './mock-planner.mjs'#" "$WORK/facade.mjs"

node "$WORK/run.mjs"
