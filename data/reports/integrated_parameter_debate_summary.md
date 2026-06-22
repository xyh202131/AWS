# 十三 Agent 参数辩论仲裁总结

更新时间：2026-06-22 04:50

## 结论

本轮不是简单把权重从 5 个加到 10 个，而是把模型拆成三层：

1. 硬门槛：官方候选名单、官方顺位、来源可信度先过滤。
2. 评分层：用 10 个维度评估“谁更可能被选”。
3. 修正层：健康、价值、来源质量、球队需求置信度作为扣分、倍率和护栏。

当前代码仍只有 `consensus / need / player / upside / intel` 5 个滑块。A7 已用真实 `generateBoard` 跑过三套权重，当前最稳的可运行基线仍是：

```text
C35 / N25 / P20 / U10 / I10
```

推荐继续把 `data/boards/board_balanced_parameter_test.json` 作为当前主板，不立即改默认权重。新因素先进入数据和仲裁逻辑，再进入源码。

## 参与辩论的 Agent

本轮实际纳入 13 个报告，超过用户要求的 10 个：

| Agent | 侧重点 | 报告 |
|---|---|---|
| A4 | 风险、上限、波动 | `data/reports/a4_risk_upside_parameter_debate.md` |
| A5 | 球队偏好、适配 | `data/reports/a5_team_fit_parameter_debate.md` |
| A6 | 媒体共识权重 | `data/reports/a6_consensus_parameter_debate.md` |
| A7 | 真实算法模拟 | `data/reports/a7_parameter_board_simulation_report.md` |
| D1 | 健康、伤病、可出勤 | `data/reports/d1_health_injury_debate.md` |
| D2 | 官方 Combine 维度 | `data/reports/d2_official_combine_dimension_debate.md` |
| D3 | 热度、行情、动量 | `data/reports/d3_heat_momentum_debate.md` |
| D4 | 顺位价值、reach/fall | `data/reports/d4_pick_value_debate.md` |
| D5 | 球队需求置信度 | `data/reports/d5_team_fit_confidence_debate.md` |
| D6 | 年龄、发展曲线、上限 | `data/reports/d6_age_upside_debate.md` |
| D7 | 位置价值、角色原型 | `data/reports/d7_positional_archetype_debate.md` |
| D8 | 来源质量、证据分层 | `data/reports/d8_source_quality_debate.md` |
| D9 | 历史先验、校准 | `data/reports/d9_historical_prior_debate.md` |

## 新目标模型

目标模型满分 100，推荐维度如下：

| 维度 | 权重 | 用途 |
|---|---:|---|
| 媒体共识和大榜 | 24 | 反映主流预测、mock、big board 的稳定共识 |
| 热度和动量 | 12 | 反映临近选秀时的升温、重复出现、近期消息 |
| 球员能力和角色原型 | 16 | 反映投篮、创造、防守、尺寸、球商、现代位置价值 |
| 球队适配，带置信度门控 | 14 | 反映球队需求，但证据弱时自动降权 |
| 年龄、上限、发展曲线 | 8 | 反映年轻球员和高上限球员的溢价 |
| 健康和可出勤 | 8 | 反映伤病、医疗、复出时间和耐久性 |
| 顺位价值和 reach/fall | 7 | 防止乐透乱跳，识别同档掉落价值 |
| 官方 Combine 和体测 | 5 | 使用官方身高、体重、敏捷、弹跳、投篮、移动数据 |
| 历史先验 | 3 | 用历史选秀和 Combine 分布做校准，不直接决定人选 |
| 证据置信度和来源质量 | 3 | 奖励高质量独立来源，惩罚薄弱证据 |

这个分配的核心逻辑：

- 共识和热度合计 36，是因为选秀预测里市场信号很强。
- 球员本体、体测、年龄、健康合计 37，避免只抄 mock。
- 球队适配 14，但必须被置信度门控，因为当前 15 个 team context 仍是 `needs_review`。
- 价值、历史、来源质量合计 13，作为护栏和校准，不让模型过拟合单一新闻。

## 当前代码映射

现有 5 因子可以这样临时承接新模型：

| 现有字段 | 暂时承接的新因素 |
|---|---|
| `consensus` | 媒体共识、大榜、部分顺位价值 |
| `need` | 球队适配，必须按证据置信度降权 |
| `player` | 球员能力、角色原型、官方 Combine |
| `upside` | 年龄、上限、发展曲线、部分健康风险 |
| `intel` | 热度、近期消息、来源质量、临场伤病消息 |

但这只是过渡方案。不要长期把健康、来源质量、价值全部揉进 `intel`，否则解释会混乱。

## 健康和伤病规则

D1 结论是健康必须单独存在，不能只作为普通风险备注。

建议分级：

| 等级 | 分数修正 | 含义 |
|---|---:|---|
| Green | 0 | 无明确风险 |
| Yellow | -2 | 有轻微或旧伤提醒 |
| Orange | -5 | 明确需要医疗复核 |
| Red | -10 | 高风险，会影响首轮位置 |
| Late medical red | -12 | 临近提交前出现严重医疗负面 |

当前优先复核：

- Red：`Jayden Quaintance`
- Orange：`Mikel Brown Jr.`、`Darryn Peterson`、`Caleb Wilson`、`Tarris Reed Jr.`
- Yellow 或波动：`Nate Ament`、`Yaxel Lendeborg`、`Labaron Philon Jr.`、`Darius Acuff Jr.`、`Karim Lopez`、`Koa Peat`、`Henri Veesaar`

## 顺位价值规则

D4 结论是价值维度不能等同于共识排名，需要防止模型“为了适配而乱 reach”。

推荐护栏：

- 前 5 顺位不能跨大档 reach，除非有明确球队偏好证据。
- 乐透区如果比共识高 3 个以上顺位，需要同时满足球队适配和健康检查。
- 15-30 顺位可以更看角色 fit，但不能同时来源弱、健康差、角色不清。
- 同档掉落球员可以优先于轻微需求不匹配。

## 官方数据使用边界

官方数据优先级最高，但不同官方数据用途不同：

- NBA.com Prospects：决定候选名单硬门槛。
- NBA.com Draft Order：决定 30 支球队和顺位。
- 官方 Combine 指标字典：决定字段含义、单位和归一化方式。
- 历史选秀和历史 Combine：做历史先验和分位校准。

当前 `DraftCombineHistory2000_2025.csv` 实际是 Excel/OpenXML 工作簿，不能按普通 CSV 读。当前 30 人里历史 Combine 只直接命中 `Yaxel Lendeborg` 和 `Labaron Philon Jr.`，其他球员暂时保持 neutral，不要因为缺历史 Combine 记录而扣分。

## 源质量规则

D8 的结论是来源质量更适合做倍率和门槛，而不是普通加分。

建议倍率：

| 来源 | 倍率 |
|---|---:|
| 官方本地数据、NBA.com 官方实时页 | 1.00 |
| ESPN、CBS、Yahoo、The Ringer、The Athletic、Bleacher Report 等主流媒体 | 0.86 |
| NBC 等二级媒体 | 0.68 |
| Tankathon、RealGM 等追踪/交易参考 | 0.55 |
| Wikipedia | 0 |
| Reddit、Facebook、Instagram、自媒体视频 | 0 |

## 下一步落地顺序

1. 先把 `healthAvailability`、`sourceConfidence`、`needConfidence`、`valueTier`、`combineProfile` 加成可选字段。
2. 继续保留当前 Import Data 兼容性，不破坏已有 `final_import_bundle.json`。
3. 把健康和来源质量先做成分数修正，不急着改 UI 默认滑块。
4. 再把 `DraftPick.breakdown` 扩成 10 因子调试输出。
5. 跑 5 套 board：baseline、consensus-heavy、health-risk-averse、value-protection、late-intel。
6. Supervisor 只审查分歧顺位和医疗风险，不重新审 30 个顺位。

机器可读版本见：

```text
data/reports/integrated_scoring_framework.json
```
