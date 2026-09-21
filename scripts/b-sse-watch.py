#!/usr/bin/env python3
"""Watch a build job's SSE stream: timestamps every event + heartbeat, so
pacing (one-by-one assembly) and keepalives (proxy survival) are provable."""
import json
import sys
import time
import urllib.request

BASE = "http://localhost:3000"
job = sys.argv[1]
budget = float(sys.argv[2]) if len(sys.argv) > 2 else 300.0

req = urllib.request.Request(f"{BASE}/api/agent/build/events?id={job}")
t0 = time.time()
counts = {}
last_graph_units = 0
mutation_times = []  # timestamps of graph events (pacing evidence)

with urllib.request.urlopen(req, timeout=budget + 30) as r:
    while True:
        elapsed = time.time() - t0
        if elapsed > budget:
            print(f"[+{elapsed:6.1f}s] BUDGET REACHED (still open — stream healthy)")
            break
        line = r.readline()
        if not line:
            print(f"[+{time.time()-t0:6.1f}s] STREAM CLOSED BY SERVER")
            break
        s = line.decode().rstrip("\n")
        if s == "":
            continue
        if s.startswith(":"):
            print(f"[+{time.time()-t0:6.1f}s] HEARTBEAT {s}")
            continue
        if s.startswith("event:"):
            print(f"[+{time.time()-t0:6.1f}s] NAMED-EVENT {s}")
            continue
        if not s.startswith("data: "):
            continue
        try:
            ev = json.loads(s[6:])
        except Exception:
            continue
        t = ev.get("type")
        counts[t] = counts.get(t, 0) + 1
        if t == "family":
            print(f"[+{time.time()-t0:6.1f}s] family={ev.get('family')} {ev.get('label')}")
        elif t == "phase":
            print(f"[+{time.time()-t0:6.1f}s] PHASE {ev.get('phase')} — {ev.get('label')}")
        elif t == "tool":
            args = ev.get("args") or {}
            tgt = args.get("id") or args.get("unit") or args.get("stream") or ""
            print(f"[+{time.time()-t0:6.1f}s]   tool {ev.get('name')} {tgt} ok={ev.get('ok')}")
        elif t == "graph":
            g = ev.get("graph") or {}
            n = len(g.get("units", []))
            if n != last_graph_units:
                mutation_times.append(round(time.time() - t0, 2))
                print(f"[+{time.time()-t0:6.1f}s]   GRAPH → {n} units, {len(g.get('streams', []))} streams")
                last_graph_units = n
        elif t == "message":
            txt = (ev.get("text") or "").replace("\n", " ")[:90]
            print(f"[+{time.time()-t0:6.1f}s] message[{ev.get('role')}] {txt}")
        elif t == "done":
            print(f"[+{time.time()-t0:6.1f}s] DONE success={ev.get('success')} units={ev.get('unitCount')} streams={ev.get('streamCount')}")
            break
        elif t in ("solve", "verdict", "usage", "error", "tour"):
            print(f"[+{time.time()-t0:6.1f}s] {t}: {json.dumps(ev)[:140]}")

print("---- counts ----")
print(json.dumps(counts))
if len(mutation_times) >= 2:
    gaps = [round(b - a, 2) for a, b in zip(mutation_times, mutation_times[1:])]
    print(f"graph-mutation times: {mutation_times}")
    print(f"gaps between unit-count changes: {gaps}")
