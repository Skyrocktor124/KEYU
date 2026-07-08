#!/usr/bin/env python3
"""Turn scanner output into a concrete, sized order plan.

Reads the JSON written by `scanner.py --out opps.json` and, for a given
bankroll and per-trade cap, prints exactly which legs to buy, at what
limit price, in what size, and how much profit each set locks in.

This tool does NOT place orders. Execute the plan manually on the
Polymarket UI, or feed it to your own py-clob-client loop (see README).

Usage:
  python3 scanner.py --out opps.json
  python3 executor.py opps.json --bankroll 2000 --max-per-trade 500
"""

import argparse
import json
import sys


def build_plan(opportunities, bankroll, max_per_trade, min_edge_pct=0.5):
    """Allocate bankroll across opportunities, best edge first.

    Returns (plan, totals) where plan is a list of sized trades and
    totals summarizes deployed capital and locked-in profit.
    """
    plan = []
    remaining = bankroll
    for opp in sorted(opportunities, key=lambda o: o["edge_pct"], reverse=True):
        if remaining <= 0:
            break
        if opp["edge_pct"] < min_edge_pct:
            continue
        cost = opp["cost_per_set"]
        if cost <= 0:
            continue
        budget = min(remaining, max_per_trade)
        sets = int(budget / cost)
        if sets < 1:
            continue
        spend = round(sets * cost, 2)
        profit = round(sets * opp["edge"], 2)
        plan.append({
            "question": opp["question"],
            "type": opp["type"],
            "sets": sets,
            "cost_per_set": cost,
            "spend": spend,
            "locked_profit": profit,
            "edge_pct": opp["edge_pct"],
            "instructions": leg_instructions(opp, sets),
        })
        remaining = round(remaining - spend, 2)
    totals = {
        "deployed": round(bankroll - remaining, 2),
        "locked_profit": round(sum(t["locked_profit"] for t in plan), 2),
        "unused": remaining,
    }
    return plan, totals


def leg_instructions(opp, sets):
    if opp["type"] == "single":
        return (f"Buy {sets} YES and {sets} NO in this market with limit "
                f"orders at the current best asks (total ≤ "
                f"${opp['cost_per_set']}/pair). All-or-cancel both legs.")
    side = "YES" if opp["type"] == "long-all" else "NO"
    return (f"Buy {sets} {side} in EACH of the {opp['num_outcomes']} outcome "
            f"markets of this event at current best asks (total ≤ "
            f"${opp['cost_per_set']}/set). If any leg misses, cancel the rest "
            f"and unwind filled legs immediately.")


def render(plan, totals):
    if not plan:
        return ("Nothing tradable: no opportunity clears the edge threshold "
                "at a size worth at least one full set.")
    lines = []
    for i, t in enumerate(plan, 1):
        lines.append(f"[{i}] {t['question'][:70]}")
        lines.append(f"    type={t['type']}  sets={t['sets']}  "
                     f"spend=${t['spend']}  locks in ${t['locked_profit']} "
                     f"({t['edge_pct']}%)")
        lines.append(f"    -> {t['instructions']}")
    lines.append("-" * 78)
    lines.append(f"TOTAL: deploy ${totals['deployed']}  ->  locked profit "
                 f"${totals['locked_profit']}  (unused ${totals['unused']})")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("opps_json", help="JSON file from scanner.py --out")
    parser.add_argument("--bankroll", type=float, required=True,
                        help="total USDC you are willing to deploy")
    parser.add_argument("--max-per-trade", type=float, default=500.0,
                        help="cap per opportunity (limits depth/slippage risk)")
    parser.add_argument("--min-edge-pct", type=float, default=0.5,
                        help="ignore opportunities below this edge percent")
    args = parser.parse_args(argv)

    with open(args.opps_json) as fh:
        opportunities = json.load(fh)
    plan, totals = build_plan(opportunities, args.bankroll,
                              args.max_per_trade, args.min_edge_pct)
    print(render(plan, totals))
    return 0


if __name__ == "__main__":
    sys.exit(main())
