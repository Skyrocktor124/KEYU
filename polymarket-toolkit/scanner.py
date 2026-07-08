#!/usr/bin/env python3
"""Polymarket arbitrage scanner.

Scans active Polymarket markets for three classes of (near-)riskless
mispricings, using only public, unauthenticated APIs:

  1. single   - one market where best_ask(YES) + best_ask(NO) < $1.
                Buy both sides; the pair redeems for exactly $1 at
                resolution regardless of outcome.
  2. long-all - a mutually-exclusive multi-outcome event where the sum
                of best_ask(YES) across all outcomes < $1. Exactly one
                outcome pays $1.
  3. neg-risk - the same event type where the sum of best_ask(NO)
                across N outcomes < N - 1. Exactly N-1 NO positions
                pay $1 each.

Zero third-party dependencies: runs with plain python3.

Usage:
  python3 scanner.py                    # scan top markets by 24h volume
  python3 scanner.py --min-edge 0.005   # only report edges >= 0.5%
  python3 scanner.py --limit 200 --out opportunities.json
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request

GAMMA_API = "https://gamma-api.polymarket.com"
USER_AGENT = "polymarket-toolkit/1.0 (personal research scanner)"


def http_get_json(url, timeout=20):
    """GET a URL and parse JSON. Raises on HTTP/network errors."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_events(fetch_json, limit=100, offset=0):
    """Fetch active events (an event groups one or more markets)."""
    params = urllib.parse.urlencode({
        "closed": "false",
        "active": "true",
        "archived": "false",
        "limit": str(limit),
        "offset": str(offset),
        "order": "volume24hr",
        "ascending": "false",
    })
    return fetch_json(f"{GAMMA_API}/events?{params}")


def market_quotes(market):
    """Extract (yes_ask, no_ask) from a gamma market dict, or None.

    Gamma exposes bestAsk/bestBid for the YES token. The NO token's ask
    equals 1 - bestBid(YES) because selling YES at the bid is equivalent
    to buying NO at 1 - bid on Polymarket's binary CLOB.
    """
    try:
        best_ask = float(market["bestAsk"])
        best_bid = float(market["bestBid"])
    except (KeyError, TypeError, ValueError):
        return None
    if not (0.0 < best_ask <= 1.0 and 0.0 <= best_bid < 1.0):
        return None
    return best_ask, 1.0 - best_bid


def scan_single_market(market, min_edge):
    """Class 1: YES ask + NO ask < 1 within a single market."""
    quotes = market_quotes(market)
    if quotes is None:
        return None
    yes_ask, no_ask = quotes
    cost = yes_ask + no_ask
    edge = 1.0 - cost
    if edge < min_edge:
        return None
    return {
        "type": "single",
        "question": market.get("question", "?"),
        "market_id": market.get("id"),
        "cost_per_pair": round(cost, 4),
        "payout_per_pair": 1.0,
        "edge": round(edge, 4),
        "edge_pct": round(edge / cost * 100, 2),
        "profit_per_100usd": round(edge / cost * 100, 2),
    }


def scan_event_arbs(event, min_edge):
    """Classes 2 and 3: cross-outcome arbs inside one exclusive event.

    Only meaningful when the event's outcomes are mutually exclusive and
    exhaustive; Polymarket flags these events with negRisk=true.
    """
    if not event.get("negRisk"):
        return []
    markets = event.get("markets") or []
    quote_list = [market_quotes(m) for m in markets]
    if len(markets) < 2 or any(q is None for q in quote_list):
        return []

    results = []
    n = len(markets)
    title = event.get("title", "?")

    yes_cost = sum(q[0] for q in quote_list)
    edge = 1.0 - yes_cost
    if edge >= min_edge:
        results.append({
            "type": "long-all",
            "question": title,
            "event_id": event.get("id"),
            "num_outcomes": n,
            "cost_per_set": round(yes_cost, 4),
            "payout_per_set": 1.0,
            "edge": round(edge, 4),
            "edge_pct": round(edge / yes_cost * 100, 2),
            "profit_per_100usd": round(edge / yes_cost * 100, 2),
        })

    no_cost = sum(q[1] for q in quote_list)
    payout = float(n - 1)
    edge = payout - no_cost
    if edge >= min_edge:
        results.append({
            "type": "neg-risk",
            "question": title,
            "event_id": event.get("id"),
            "num_outcomes": n,
            "cost_per_set": round(no_cost, 4),
            "payout_per_set": payout,
            "edge": round(edge, 4),
            "edge_pct": round(edge / no_cost * 100, 2),
            "profit_per_100usd": round(edge / no_cost * 100, 2),
        })
    return results


def scan(fetch_json, limit=100, min_edge=0.005):
    """Run a full scan and return opportunities sorted by edge_pct desc."""
    events = fetch_events(fetch_json, limit=limit)
    opportunities = []
    for event in events:
        opportunities.extend(scan_event_arbs(event, min_edge))
        for market in event.get("markets") or []:
            hit = scan_single_market(market, min_edge)
            if hit:
                opportunities.append(hit)
    opportunities.sort(key=lambda o: o["edge_pct"], reverse=True)
    return opportunities


def render_table(opportunities):
    if not opportunities:
        return "No opportunities at or above the edge threshold right now."
    lines = [
        f"{'TYPE':<9} {'EDGE%':>6} {'$/100':>6}  QUESTION",
        "-" * 78,
    ]
    for o in opportunities:
        lines.append(
            f"{o['type']:<9} {o['edge_pct']:>6.2f} {o['profit_per_100usd']:>6.2f}"
            f"  {o['question'][:55]}"
        )
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--limit", type=int, default=100,
                        help="number of top-volume events to scan")
    parser.add_argument("--min-edge", type=float, default=0.005,
                        help="minimum absolute edge in dollars per set")
    parser.add_argument("--out", help="also write opportunities as JSON here")
    parser.add_argument("--watch", type=int, metavar="SECONDS",
                        help="re-scan continuously at this interval")
    args = parser.parse_args(argv)

    while True:
        try:
            opportunities = scan(http_get_json, args.limit, args.min_edge)
        except Exception as exc:
            print(f"scan failed: {exc}", file=sys.stderr)
            if not args.watch:
                return 1
            time.sleep(args.watch)
            continue
        print(time.strftime("%Y-%m-%d %H:%M:%S"))
        print(render_table(opportunities))
        if args.out:
            with open(args.out, "w") as fh:
                json.dump(opportunities, fh, indent=2, ensure_ascii=False)
            print(f"wrote {len(opportunities)} opportunities to {args.out}")
        if not args.watch:
            return 0
        time.sleep(args.watch)


if __name__ == "__main__":
    sys.exit(main())
