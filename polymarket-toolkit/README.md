# Polymarket 低风险收益工具包

一套可复用的 Polymarket 套利扫描 + 执行流程。零第三方依赖，`python3` 直接运行。

> **先说实话（必读）**
>
> 1. **没有任何策略能"保证 2 小时赚 200 美元"。** 谁承诺这个谁在骗你。
>    本工具找的是数学上无风险的错价（买入组合的结算价值 > 成本），但这类
>    机会的利润率通常只有 0.5%–3%，且深度有限。**要在一次机会里赚 $200，
>    大约需要 $7,000–$40,000 的可用资金**，并且当时恰好存在足够深的错价。
> 2. **资金与账户是你自己的。** 本工具只做扫描和计算，不碰你的私钥；
>    下单由你本人确认执行。
> 3. **合规自查。** 请确认你所在司法辖区允许使用 Polymarket 后再交易。
> 4. 本环境（Claude 远程容器）的出口网络无法访问 Polymarket API，
>    所以扫描器需要**在你自己的电脑上运行**。代码逻辑已用离线单元测试
>    验证（`python3 -m unittest -v`，10/10 通过）。

## 三类机会（按风险从低到高）

| 类型 | 条件 | 操作 | 结算结果 |
|---|---|---|---|
| `single` | 同一市场 YES 卖价 + NO 卖价 < $1 | 两边各买 1 份 | 无论结果，每对稳得 $1 |
| `long-all` | 互斥事件所有结果 YES 卖价之和 < $1 | 每个结果各买 1 份 YES | 恰有一个结果付 $1 |
| `neg-risk` | N 个互斥结果 NO 卖价之和 < N−1 | 每个结果各买 1 份 NO | 恰有 N−1 份各付 $1 |

这三类的共同点：**买入即锁定利润，与事件结果无关**。剩余风险只有：
成交滑点（挂单在你下单前被吃掉）、资金占用到结算日、平台风险。

## 快速开始（在你的电脑上）

```bash
cd polymarket-toolkit
python3 -m unittest -v          # 先验证逻辑（离线，无需网络）
python3 scanner.py               # 扫描当前成交量前 100 的事件
python3 scanner.py --min-edge 0.01 --out opps.json   # 只要 ≥1% 边际，存 JSON
python3 scanner.py --watch 60    # 每 60 秒重扫一次（机会转瞬即逝，建议常驻）
```

输出示例：

```
TYPE       EDGE%  $/100  QUESTION
------------------------------------------------------------------------------
neg-risk    1.52   1.52  Who will win the 2026 NBA Finals?
single      0.85   0.85  Will X happen by August 31?
```

`$/100` = 每投入 $100 锁定的利润。**目标 $200 ⇒ 需要 `200 / (edge% ) × 100`
的资金**。例如 1.5% 边际需要约 $13,300 成交额（可多笔累积）。

## 从扫描到下单清单（executor.py）

```bash
python3 scanner.py --out opps.json
python3 executor.py opps.json --bankroll 2000 --max-per-trade 500
```

executor 会按边际从高到低分配你的资金，输出每个机会**买哪几条腿、
买多少份、花多少钱、锁定多少利润**的清单，以及总计。它不会替你下单——
拿着清单到 Polymarket 界面手动执行，或接入你自己的 py-clob-client 循环。

## 执行（手动，最安全）

1. 扫到机会后，立刻打开对应市场页面核对**订单簿深度**——
   scanner 用的是最优报价，实际能吃到的量以订单簿为准。
2. 用限价单（不要市价单）按扫描到的卖价挂单买入组合的**每一条腿**。
3. 所有腿都成交才算锁定；若某条腿没成交，立即取消其余挂单并平掉已成交腿。
4. 持有至结算，或若组合市价回归 $1 附近可提前卖出释放资金。

## 执行（程序化，进阶）

官方 Python 客户端：`pip install py-clob-client`（需要一个有 USDC 的
Polygon 钱包）。骨架：

```python
from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, OrderType

client = ClobClient(
    "https://clob.polymarket.com",
    key=PRIVATE_KEY,          # 从环境变量读，永远不要写进代码/提交进 git
    chain_id=137,
)
client.set_api_creds(client.create_or_derive_api_creds())
order = client.create_order(OrderArgs(
    price=0.48, size=100, side="BUY", token_id=YES_TOKEN_ID,
))
client.post_order(order, OrderType.GTC)
```

把 `scanner.py --out opps.json` 的输出接到你自己的下单循环即可。
**强烈建议先用 $50 以内的单子跑通整个流程再放大。**

## 可复用的两小时作战流程（Runbook）

1. **第 0 分钟**：`python3 scanner.py --watch 30 --min-edge 0.008` 常驻。
2. **资金准备**：USDC 已在 Polymarket 账户内，避免临时充值错过窗口。
3. **出现机会**：核对深度 → 计算本次可成交量 → 分腿限价下单 → 确认全部成交。
4. **记录**：把每笔的成本/锁定利润记入表格（复盘用）。
5. **第 110 分钟**：停止开新仓，只处理未成交腿。
6. **复盘**：哪些机会错过了、滑点多少、下次阈值怎么调。

高频复用：把第 1 步挂成 `cron`/常驻进程 + 手机通知（例如
`--out opps.json` 后接一个发通知的脚本），机会出现时人到场执行。

## 如果资金不足以靠套利达标

套利是唯一"数学上稳赚"的路径，但吃资金量。资金小的现实替代
（**有亏损风险**，不在本工具承诺范围内）：

- **流动性奖励**：Polymarket 对在指定市场挂双边限价单的做市者按天发奖励，
  是平台上最接近"稳定收入"的机制，但持仓有方向性风险。
- **信息优势交易**：只交易你真正比市场懂的领域。这是投机，不是套利。

## 文件

- `scanner.py` — 扫描器（零依赖，含 `--watch` 常驻模式）
- `executor.py` — 资金分配与下单清单生成器（不碰私钥，不自动下单）
- `test_scanner.py`, `test_executor.py` — 16 个离线单元测试，验证全部数学
