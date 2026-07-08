"""Offline unit tests for scanner.py — run: python3 -m unittest -v

All API responses are mocked, so these tests verify the arbitrage math
without network access.
"""

import unittest

import scanner


def market(question, best_ask, best_bid, market_id="m1"):
    return {"question": question, "id": market_id,
            "bestAsk": best_ask, "bestBid": best_bid}


class SingleMarketArb(unittest.TestCase):
    def test_detects_underpriced_pair(self):
        # YES ask 0.48, NO ask = 1 - bid = 0.49 -> pair costs 0.97
        hit = scanner.scan_single_market(market("q", 0.48, 0.51), 0.005)
        self.assertIsNotNone(hit)
        self.assertEqual(hit["type"], "single")
        self.assertAlmostEqual(hit["cost_per_pair"], 0.97)
        self.assertAlmostEqual(hit["edge"], 0.03)
        self.assertAlmostEqual(hit["edge_pct"], 3.09)

    def test_ignores_fairly_priced_pair(self):
        # YES ask 0.50, NO ask 0.51 -> pair costs 1.01, no arb
        self.assertIsNone(scanner.scan_single_market(market("q", 0.50, 0.49), 0.005))

    def test_ignores_edge_below_threshold(self):
        # edge is 0.004, threshold 0.005
        self.assertIsNone(scanner.scan_single_market(market("q", 0.496, 0.50), 0.005))

    def test_ignores_missing_or_bad_quotes(self):
        self.assertIsNone(scanner.scan_single_market({"question": "q"}, 0.005))
        self.assertIsNone(scanner.scan_single_market(market("q", 0.0, 0.5), 0.005))
        self.assertIsNone(scanner.scan_single_market(market("q", "n/a", 0.5), 0.005))


class EventArbs(unittest.TestCase):
    def test_long_all_yes(self):
        # 3 exclusive outcomes; YES asks sum to 0.95 -> buy all, edge 0.05
        event = {"title": "Who wins?", "id": "e1", "negRisk": True, "markets": [
            market("A", 0.40, 0.38), market("B", 0.35, 0.33),
            market("C", 0.20, 0.18),
        ]}
        hits = [h for h in scanner.scan_event_arbs(event, 0.005)
                if h["type"] == "long-all"]
        self.assertEqual(len(hits), 1)
        self.assertAlmostEqual(hits[0]["cost_per_set"], 0.95)
        self.assertAlmostEqual(hits[0]["edge"], 0.05)

    def test_negative_risk(self):
        # NO asks: (1-0.62)+(1-0.30)+(1-0.10) = 0.38+0.70+0.90 = 1.98
        # payout N-1 = 2 -> edge 0.02
        event = {"title": "Who wins?", "id": "e1", "negRisk": True, "markets": [
            market("A", 0.65, 0.62), market("B", 0.33, 0.30),
            market("C", 0.12, 0.10),
        ]}
        hits = [h for h in scanner.scan_event_arbs(event, 0.005)
                if h["type"] == "neg-risk"]
        self.assertEqual(len(hits), 1)
        self.assertAlmostEqual(hits[0]["cost_per_set"], 1.98)
        self.assertAlmostEqual(hits[0]["payout_per_set"], 2.0)
        self.assertAlmostEqual(hits[0]["edge"], 0.02)

    def test_skips_non_exclusive_events(self):
        event = {"title": "t", "negRisk": False,
                 "markets": [market("A", 0.4, 0.38), market("B", 0.3, 0.28)]}
        self.assertEqual(scanner.scan_event_arbs(event, 0.005), [])

    def test_skips_event_with_unquotable_market(self):
        event = {"title": "t", "negRisk": True,
                 "markets": [market("A", 0.4, 0.38), {"question": "B"}]}
        self.assertEqual(scanner.scan_event_arbs(event, 0.005), [])


class FullScan(unittest.TestCase):
    def test_scan_sorts_by_edge_pct(self):
        events = [
            {"title": "exclusive", "id": "e1", "negRisk": True, "markets": [
                market("A", 0.40, 0.38), market("B", 0.35, 0.33),
                market("C", 0.20, 0.18),
            ]},
            {"title": "plain", "id": "e2", "negRisk": False, "markets": [
                market("cheap pair", 0.48, 0.51, "m9"),
            ]},
        ]
        fake_fetch = lambda url: events
        hits = scanner.scan(fake_fetch, limit=10, min_edge=0.005)
        self.assertGreaterEqual(len(hits), 2)
        pcts = [h["edge_pct"] for h in hits]
        self.assertEqual(pcts, sorted(pcts, reverse=True))

    def test_render_table_handles_empty(self):
        self.assertIn("No opportunities", scanner.render_table([]))


if __name__ == "__main__":
    unittest.main()
