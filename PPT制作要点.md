# DraftOps PPT 制作指导

这份文件用于指导 DraftOps 展示稿的内容、叙事和视觉组织。核心原则是：

```text
成品只讲 DraftOps 项目重点，不复述比赛规则，不把画面写成“这份 PPT 在讲什么”。
```

展示目标不是把所有代码、数据和报告塞满，而是让观众在 6 分钟内相信三件事：

1. 这是一个真实可运行的预测产品，不是一段模型回答。
2. 预测结果来自可复核的数据链路、Agent 流程和算法护栏。
3. 最终交付物可以导出、验证、提交，并能回答项目相关问题。

## 一、当前已验证事实

制作时优先引用当前仓库事实，避免沿用旧数字或旧表述。

| 事实 | 当前值 | 来源 |
|---|---:|---|
| 首轮预测板 | 30 picks / 30 unique | `public/data/agent_expanded_recommended_board.json` |
| 手工改人 | `noManualOverride: true` | `public/data/agent_expanded_recommended_board.json` |
| 当前前端候选池 | 123 prospects | `public/data/expanded_import_bundle.json` |
| 本地答题候选池 | 124 prospects | `data/normalized/normalized_2026_local_player_pool_124.json` |
| 球员特征记录 | 124 records | `data/normalized/normalized_2026_player_feature_reference_124.json` |
| 里程碑答案 | 7 answers | `data/final/milestone_answers.json` |
| RAG 索引 | 5 indexes / 1304 kept chunks / 55 sources | `data/rag/rag-manifest.json` |
| relative scoring 复核 | 3255 candidate reviews | `public/data/agent_expanded_recommended_board.json` |
| 产品截图素材 | 首页、证据页、导出页 | `roadshow-ppt/images/` |

最近一次在线监控结果：

- `npm run draft:watch -- --once`：无变动；NBA.com Prospects 101；Combine 73/78；Early-entry 71；本地池 124。
- `npm run news:watch -- --once --official-only`：暂无新增球队变动；已检查 4/4 个官方源。
- 最新对齐快照见 `roadshow-ppt/projects/draftops_roadshow_ppt169_20260624/latest_data_snapshot_20260624.md`。

数字使用边界：

- `101` 只用于说明 NBA.com 官方 Prospects 捕获，不要拿它代替当前前端候选池。
- `124` 用于说明本地答题池和特征记录。
- `123` 用于说明当前前端扩展候选池和 relative scoring 的剩余池。
- `7` 是当前里程碑答案数量，旧文档里的 `8` 不再作为当前事实直接展示。

## 二、全局叙事

推荐一句话定位：

```text
DraftOps 是一个可解释的 NBA 选秀预测驾驶舱，把数据、Agent、算法和导出交付串成一个可复核系统。
```

主线顺序：

```text
可信数据 -> Agent 文件协作 -> relative scoring 预测 -> 产品驾驶舱 -> AWS/RAG 问答 -> 提交与验证
```

成品不要按“比赛规则、评分点、提交要求”展开。比赛要求只作为内部约束，用来决定内容取舍；画面上要呈现项目做法和产品能力。

## 三、创新点

### 1. Agent-only 文件协作

创新点：

- 多 Agent 不是聊天投票，而是通过结构化文件交接。
- A0 Supervisor 可以退回缺证据、缺字段、不合法的输出。
- 预测结果不能由前端人工换人、调权或重排，必须由数据、参数或脚本重跑产生。

展示方式：

- 用流程图展示 `A1 数据 -> A3 质检 -> A6 参数 -> A7 预测 -> A12 验收`。
- 重点突出“文件交付”和“完整重跑”，不要把 Agent 画成泛泛的多角色聊天。

### 2. 双候选池与证据链路

创新点：

- 同时维护官方来源、本地答题池、扩展前端候选池和特征记录。
- 数据经过 raw、normalized、clean、final、public 同步链路。
- 每个 pick 保留 evidence、warnings、alternatives 和 source notes。

展示方式：

- 数据页用一条链路图，不放大表格。
- 数字只放关键值：`30 / 123 / 124 / 7 / 1304`。

### 3. relative scoring 顺位预测

创新点：

- 不是一次性给 30 个名字，而是每个签位基于当前剩余候选池重新评分。
- 每选中一名球员就移出候选池，避免重复。
- 当前 board 记录了 3255 次候选评审，用于说明系统有过程、有审计，而不是直接输出答案。

展示方式：

- 伪公式只保留一行：

```text
总分 = 共识 + 需求 + 能力 + 潜力 + 情报 - 风险
```

- 不展示过细权重，不展示内部参数滑块。
- 讲法聚焦“为什么稳定、为什么可解释、为什么不会重复”。

### 4. 产品化预测驾驶舱

创新点：

- 首页直接展示 30 顺位完整 board。
- 右侧证据区能查看单个 pick 的理由、风险、球队适配、备选项和来源。
- 导出不是截图，而是 submission JSON、项目摘要和答题卡相关产物。

展示方式：

- 必须使用真实截图。
- 第 6 页建议采用“大截图 + 3 个 callout”结构。
- callout 只标注用户能看见的产品能力：预测板、证据、导出。

### 5. AWS/RAG 只读问答层

创新点：

- RAG 不是替代预测算法，而是用于回答项目、数据、预测、里程碑和架构问题。
- 5 个索引覆盖 core board、team preference、prospect evidence、milestone、architecture。
- Lambda/API 层保持只读边界，不改代码、不换人、不覆盖 board。

展示方式：

- 架构图讲清 `前端 -> API/Lambda -> RAG -> S3/DynamoDB -> 模型层`。
- 边界要诚实：当前仓库包含 Lambda API 与同步脚本，不要夸大成完整 IaC 平台。

### 6. 训练与多模型复核作为增强证据

创新点：

- Git 历史显示项目从基础 board 进化到 RAG grounding、LLM variant、trained rerank diagnostics、Codex relative scoring runs。
- 训练报告使用 3255 条候选评分状态做参数校准，训练层能把最终选择排到 top 5 的状态达到 30/30。
- 三 Agent relative summary 可以作为“多模型交叉复核”的证据，但不要让它抢走产品主线。

展示方式：

- 正片中只提一句“预测结果经过 relative scoring 与多 Agent 复核”。
- 详细对比表适合放备份页或答辩问答，不适合主流程展开。

## 四、设计点

### 内容设计

1. 每页只回答一个问题。
2. 每页标题写结论，不写“背景介绍”“技术方案”。
3. 成品画面不要出现 `这份 PPT`、`本页`、`路演评分`、`比赛任务不是` 这类自指或复述词。
4. 不要把 README 原文搬上去。
5. 不要展示 API key、Token、账号 ID、私有链接。
6. 不要展示可被理解成人工改预测的入口。

### 视觉设计

1. 主视觉是产品驾驶舱，不是抽象概念图。
2. 深色背景可以保留，但每页必须有一个亮点：数字、流程、截图或架构节点。
3. 产品截图要足够大，能够看见 30 顺位表和右侧证据区。
4. 图标只服务信息分组：数据、Agent、算法、导出、云架构。
5. 表格最多 3 到 5 行，完整明细留在系统里。
6. 关键数字可放大：`30`、`123`、`124`、`7`、`1304`、`3255`。

### 讲解设计

讲的时候不要按文件名讲，要按观众关心的问题讲：

1. 产品解决什么问题？
2. 数据从哪里来，为什么可信？
3. Agent 如何分工，如何防止幻觉？
4. 算法如何把数据变成 30 顺位？
5. 产品界面如何支持复核和导出？
6. AWS/RAG 在系统中承担什么角色？
7. 最终交付物如何验证？

## 五、推荐 8 页结构

| 页码 | 时间 | 标题方向 | 画面重点 | 必讲结论 |
|---|---:|---|---|---|
| 1 | 30 秒 | DraftOps 项目定位 | 首页截图 + 关键指标 | 这是一个可运行的预测驾驶舱 |
| 2 | 35 秒 | 项目重点总览 | 数据 / Agent / 算法 / 产品四卡 | 后面只讲项目怎么做成 |
| 3 | 50 秒 | 数据先可信，预测才可信 | 数据链路图 | 数据从原始来源进入可审计产物 |
| 4 | 50 秒 | 多 Agent 分工，不是群聊投票 | Agent 泳道图 | 每个 Agent 文件交付，Supervisor 验收 |
| 5 | 60 秒 | 预测引擎：顺位贪心 + 风险校验 | 三步算法图 + 伪公式 | 每个签位重新评分并移除已选球员 |
| 6 | 60 秒 | 产品界面佐证：预测、证据、导出 | 大截图 + 3 个 callout | 结果能查看、复核、导出 |
| 7 | 50 秒 | AWS/RAG：只读问答与追溯 | 架构图 | RAG 支撑问答，不直接改预测 |
| 8 | 40 秒 | 最终交付不是模型回答 | 三大资产卡 | 可信数据、可解释预测、可交付系统 |

如果要加备份页，只加两类：

- Git 历史与演进证据页。
- 训练/relative scoring 复核明细页。

备份页不要进入 6 分钟主线。

## 六、6 分钟讲解节奏

```text
0:00 - 0:30  产品定位
0:30 - 1:05  项目重点总览
1:05 - 1:55  数据链路
1:55 - 2:45  多 Agent 协作
2:45 - 3:45  预测算法
3:45 - 4:45  产品界面
4:45 - 5:35  AWS/RAG 架构
5:35 - 6:00  交付与验证
```

推荐开场：

```text
DraftOps 不是只输出一张预测名单，而是把候选池、球队需求、Agent 证据、预测算法和导出交付做成一个可复核的产品系统。
```

推荐 pick 解释模板：

```text
这个顺位的选择来自三层证据：
第一，球员在当前剩余候选池里的共识和能力评分足够靠前；
第二，球队需求和球员标签匹配；
第三，系统保留了风险、备选项和来源说明，所以这个结果可以被复核。
```

推荐结尾：

```text
DraftOps 的价值，是把一个容易凭经验判断的问题，拆成可信数据、可复现流程、可解释预测和可交付产品。
```

## 七、Git 历史可借鉴的讲法

Git 历史不要逐条讲给观众听，但可以作为内容判断依据。

| 提交 | 说明 | 可转化成的展示点 |
|---|---|---|
| `97976e3` | Add read-only DeepSeek QA integration | 问答层从一开始就保持只读边界 |
| `15ca465` | Update DraftOps RAG grounding and LLM variant outputs | RAG grounding、系统审计和 LLM variant 是可信度增强 |
| `00869aa` | Update DraftOps final deliverables and roadshow assets | 最终交付物、截图和讲解资产已经被打包 |
| `43be3e5` | Refresh trained rerank diagnostics | 训练/重排诊断用于参数校准，不替代主流程 |
| `1eb7781` | Add Codex relative scoring runs | relative scoring 和 Codex runs 可作为多模型复核证据 |

使用方式：

- 主流程只讲当前产品能力。
- Q&A 时再用 Git 历史证明项目不是一夜拼凑，而是经过数据、RAG、训练、复核和交付多轮迭代。

## 八、当前成品需要优先修正的方向

1. 第 2 页保持项目重点总览，不回到外部规则复述。
2. 第 5 页可以强化 `relative scoring over remaining pool` 和 `3255 candidate reviews`，但不要塞满技术细节。
3. 第 6 页应更像产品展示，截图尽量大，callout 指向真实 UI。
4. 第 7 页明确只读边界和 IaC 边界。
5. 备注讲稿要能独立口播，但不要出现“这页/这份材料/本 PPT”这类自指表达。
6. 结尾只收束项目价值，不再回到外部评分项。

## 九、最终检查清单

- [ ] 主线是产品和工程系统，不是外部规则复述。
- [ ] 可见画面没有 `这份 PPT`、`比赛任务`、`评分点`、`路演表达` 等自指或复述词。
- [ ] 每页标题都是结论句。
- [ ] 真实截图至少出现 2 次：首页和证据/导出区。
- [ ] `30 / 123 / 124 / 7 / 1304 / 3255` 等数字有明确来源，不混用。
- [ ] 不暴露密钥、Token、账号 ID 或私有链接。
- [ ] 不展示人工换人、人工调权、人工重排入口。
- [ ] 数据、Agent、算法、产品、AWS/RAG、验证六类内容都覆盖。
- [ ] 6 分钟能讲完，口播最好压到 5 分 40 秒以内。
- [ ] 最后一页回到一句话价值：可信数据、可解释预测、可交付系统。
