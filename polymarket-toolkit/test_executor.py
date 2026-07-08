"""Offline unit tests for executor.py — run: python3 -m unittest -v"""

import unittest

import executor


def opp(edge_pct, cost, edge, typ="single", question="q", n=3):
    o = {"question": question, "type": typ, "cost_per_set": cost,
         "edge": edge, "edge_pct": edge_pct}
    if typ != "single":
        o["num_outcomes"] = n
    return o


class BuildPlan(unittest.TestCase):
    def test_allocates_best_edge_first_and_respects_bankroll(self):
        opps = [opp(1.0, 0.99, 0.0099, question="small"),
                opp(3.0, 0.97, 0.03, question="big")]
        plan, totals = executor.build_plan(opps, bankroll=1000,
                                           max_per_trade=600)
        self.assertEqual(plan[0]["question"], "big")
        self.assertLessEqual(totals["deployed"], 1000)
        self.assertAlmostEqual(totals["deployed"] + totals["unused"], 1000)

    def test_respects_per_trade_cap(self):
        plan, _ = executor.build_plan([opp(2.0, 0.98, 0.02)],
                                      bankroll=10000, max_per_trade=500)
        self.assertLessEqual(plan[0]["spend"], 500)

    def test_skips_below_edge_threshold(self):
        plan, totals = executor.build_plan([opp(0.3, 0.997, 0.003)],
                                           bankroll=1000, max_per_trade=500)
        self.assertEqual(plan, [])
        self.assertEqual(totals["deployed"], 0)

    def test_locked_profit_math(self):
        # 500 / 0.97 -> 515 sets, profit = 515 * 0.03 = 15.45
        plan, totals = executor.build_plan([opp(3.09, 0.97, 0.03)],
                                           bankroll=500, max_per_trade=500)
        self.assertEqual(plan[0]["sets"], 515)
        self.assertAlmostEqual(plan[0]["locked_profit"], 15.45)
        self.assertAlmostEqual(totals["locked_profit"], 15.45)

    def test_multi_leg_instructions_mention_all_outcomes(self):
        plan, _ = executor.build_plan(
            [opp(2.0, 1.96, 0.04, typ="neg-risk", n=3)],
            bankroll=1000, max_per_trade=1000)
        self.assertIn("EACH of the 3", plan[0]["instructions"])
        self.assertIn("NO", plan[0]["instructions"])

    def test_render_empty_plan(self):
        self.assertIn("Nothing tradable", executor.render([], {
            "deployed": 0, "locked_profit": 0, "unused": 100}))


if __name__ == "__main__":
    unittest.main()
