#!/usr/bin/env python3
"""Counts, and optionally removes, the rows earlier E2E runs left on the E2E user.

  python3 e2e/leftovers.py            # counts only (run before and after a suite: the numbers must match)
  python3 e2e/leftovers.py --dry-run  # also lists every row whose name starts with "E2E"
  python3 e2e/leftovers.py --apply    # deletes them: transactions on those accounts, then tags, categories
                                      # (children first), merchants, accounts. Rows without the E2E prefix are
                                      # never touched.

Needs E2E_USERNAME and E2E_PASSWORD in the environment (E2E_API_URL if the backend is not on localhost:8080).
Deletion goes through the same API calls the app uses, so run it against the shared dev data only on purpose.
"""
import json, os, sys, urllib.request

API = os.environ.get("E2E_API_URL", "http://localhost:8080/api/v1")
PREFIX = "E2E"


def call(method, path, token=None, body=None):
    req = urllib.request.Request(f"{API}/{path}", method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


def rows(token, path):
    data = call("GET", f"{path}?size=5000", token)
    return data if isinstance(data, list) else data["content"]


def main():
    apply, dry = "--apply" in sys.argv, "--dry-run" in sys.argv
    token = call("POST", "auth/authenticate", body={"username": os.environ["E2E_USERNAME"], "password": os.environ["E2E_PASSWORD"]})["token"]
    found = {}
    for path in ("accounts", "categories", "tags", "merchants"):
        listed = rows(token, path)
        found[path] = [r for r in listed if str(r.get("name", "")).startswith(PREFIX)]
        print(f"{path:<11} total={len(listed):<5} {PREFIX}-prefixed={len(found[path])}")
        if dry or apply:
            for r in found[path]:
                print(f"    {r['id']}  {r['name']}")
    total = call("GET", "transactions?size=1", token)["page"]["totalElements"]
    print(f"transactions total={total}")
    if not apply:
        return
    for account in found["accounts"]:
        while True:
            page = call("GET", f"transactions?accountId={account['id']}&size=1000", token)["content"]
            if not page:
                break
            call("DELETE", "transactions/bulk", token, [t["id"] for t in page])
    for path in ("tags",):
        for r in found[path]:
            call("DELETE", f"{path}/{r['id']}", token)
    # a child category has a parent; delete rows that are nobody's parent first, repeatedly
    remaining = {c["id"]: c for c in found["categories"]}
    while remaining:
        parents = {(c.get("parent") or {}).get("id") for c in remaining.values()}
        leaves = [c for c in remaining.values() if c["id"] not in parents]
        for c in leaves or list(remaining.values()):
            try:
                call("DELETE", f"categories/{c['id']}", token)
            except Exception as error:
                print(f"    could not delete category {c['name']}: {error}")
            remaining.pop(c["id"], None)
    for path in ("merchants", "accounts"):
        for r in found[path]:
            try:
                call("DELETE", f"{path}/{r['id']}", token)
            except Exception as error:
                print(f"    could not delete {path} {r['name']}: {error}")
    print("done")


main()
