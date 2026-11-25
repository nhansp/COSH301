#!/usr/bin/env bash
# Live load test against production. Creates throwaway k6 accounts with session
# tokens, runs a k6 scenario through the public site, then removes the accounts.
#
#   COSH301_VM=user@host loadtest/run.sh flood [DURATION=90s HOLDERS=80 ...]
#   COSH301_VM=user@host loadtest/run.sh race  [SEAT=B3]
set -euo pipefail

VM=${COSH301_VM:?set COSH301_VM=user@host of the production VM}
SCENARIO=${1:-flood}
shift || true
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$HERE/$SCENARIO.js" ] || { echo "unknown scenario: $SCENARIO (flood or race)" >&2; exit 2; }
WORK=$(mktemp -d)
ACCOUNTS=${ACCOUNTS:-300}

psql_vm() {
  ssh -o BatchMode=yes "$VM" 'cd ~/COSH301 && docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -q -At"'
}

cleanup() {
  echo ">> Dọn tài khoản k6"
  # Expire the holds first so the server releases them and tells every open seat map.
  echo "UPDATE seat_holds SET expires_at = now() WHERE status = 'ACTIVE' AND user_id IN (SELECT id FROM users WHERE email LIKE 'k6-%@load.test');" | psql_vm
  sleep 7
  psql_vm <<'SQL'
BEGIN;
DELETE FROM seat_holds WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'k6-%@load.test');
DELETE FROM users WHERE email LIKE 'k6-%@load.test';
COMMIT;
SELECT 'còn lại ' || count(*) || ' tài khoản k6' FROM users WHERE email LIKE 'k6-%@load.test';
SQL
  rm -rf "$WORK"
}
trap cleanup EXIT

echo ">> Tạo $ACCOUNTS tài khoản k6"
python3 - "$WORK" "$ACCOUNTS" <<'PY'
import hashlib, json, secrets, sys
work, n = sys.argv[1], int(sys.argv[2])
tokens = [secrets.token_urlsafe(32) for _ in range(n)]
rows = ",\n".join(f"('k6-{i:03d}@load.test','{hashlib.sha256(t.encode()).hexdigest()}')" for i, t in enumerate(tokens))
open(f"{work}/tokens.json", "w").write(json.dumps(tokens))
open(f"{work}/seed.sql", "w").write(f"""BEGIN;
WITH v(email, th) AS (VALUES {rows}),
u AS (INSERT INTO users (email, role, status, email_verified_at, full_name)
      SELECT email, 'CUSTOMER', 'ACTIVE', now(), 'k6 load' FROM v RETURNING id, email)
INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
SELECT u.id, v.th, now() + interval '2 hours', 'k6' FROM u JOIN v USING (email);
COMMIT;
""")
PY
psql_vm < "$WORK/seed.sql"

envs=()
for kv in "$@"; do envs+=(-e "$kv"); done
echo ">> k6 run $SCENARIO.js"
docker run --rm -u "$(id -u)" -v "$HERE":/scripts:ro -v "$WORK":/work -w /work \
  -e TOKENS=/work/tokens.json "${envs[@]}" grafana/k6:1.4.2 run "/scripts/$SCENARIO.js"
