# DraftOps 多 Agent 协作指导

这份文件用于比赛现场组织多个 Agent 协作。目标不是让多个 Agent 随机讨论，而是让每个 Agent 只负责一个明确环节，并用结构化文件交接，最后由 Supervisor 统一验收。

当前项目是本地前端预测工具，核心代码在：

- `src/lib/prediction.ts`：Agent 预测、重复校验、里程碑推导
- `src/data/seedData.ts`：种子球队和球员数据
- `src/types.ts`：数据结构
- `src/lib/export.ts`：提交 JSON 和路演 brief 导出
- `src/App.tsx`：页面交互

## 1. 协作原则

1. 所有 Agent 通过文件交付，不通过口头结论交付。
2. 数据链路必须保留来源、采集时间、可信度和原文片段。
3. 预测 Agent 不直接采集数据；采集 Agent 不直接改预测结果。
4. 前端 Agent 不改算法和数据，除非 Supervisor 明确批准。
5. Supervisor 有权退回任何缺少来源、字段不完整、结构不合法的输出。
6. 最终提交前必须通过 `npm run lint` 和 `npm run build`。
7. 比赛最后 30 分钟只允许做检查、导出、提交，不做大改。
8. 绝对禁止人工预测、人工指定球员、人工换人或人工重排 1-30 顺位；人只能提出可复现的参数、规则、数据修正或复核请求，最终 30 顺位必须由 A7/脚本基于文件输入重新生成。
9. Codex 主线程同样受防幻觉约束：涉及球员、球队、顺位、候选人数、评分、来源、RAG、AWS 状态或提交字段时，必须先读取当前文件、命令输出或官方来源；缺证据时明确标记“未提供/需复核”，不能用模型记忆补写。

## 2. 数据目录

用户已经提供的原始数据入口是：

```text
C:\Users\24048\Desktop\AWS\draftops\数据
```

这个目录视为只读原始材料区。Agent 不要改名、移动或覆盖其中的文件。

用户已确认：`数据/` 是官方给定数据包。它不是普通参考资料，也不是 Agent 可随意改写的工作区。任何标准化、清洗、派生、合并结果都必须输出到 `data/`。

当前已识别的原始材料：

```text
数据/
  2000-2025_NBA选秀结果_数据汇总.xlsx
  DraftCombine_Hackathon.zip
  DraftCombine_Hackathon/
    DraftCombineHistory2000_2025.csv
    NBA_Combine_Stat_Lab_指标中英文.xlsx
    NBA_Draft_Combine_Intro_CN.pptx
    视频介绍/
```

注意：`DraftCombineHistory2000_2025.csv` 文件扩展名是 `.csv`，但实际内容是 Excel 压缩格式，需要按工作簿读取，不能按普通 CSV 读取。

Agent 生成的中间文件和报告放在 `data/` 下，避免污染源码和原始数据。

```text
data/
  raw/
    raw_sources.json
    external_source_inventory.json
    firecrawl-2026-*.json
  normalized/
    normalized_mock_data.json
    normalized_prospects.json
    normalized_teams.json
  clean/
    clean_prospects.json
    clean_teams.json
  reports/
    data_quality_report.md
    team_preference_report.md
    parameter_report.md
    conflict_report.md
    supervisor_report.md
  boards/
    board_baseline.json
    board_consensus_heavy.json
    board_team_need_heavy.json
    board_late_intel_heavy.json
  final/
    final_import_bundle.json
    final_board.json
    milestone_answers.json
    submission_notes.md
```

前端导入优先使用 Agent 产出的最终文件：

```text
data/final/final_import_bundle.json
```

格式必须是：

```json
{
  "teams": [],
  "prospects": []
}
```

当前来源登记状态：

- `data/raw/raw_sources.json` 已合并官方本地来源和第一批外部 Web 来源。
- `data/raw/external_source_inventory.json` 已完成外部来源分层。
- `data/raw/firecrawl-2026-big-board-search.json`、`firecrawl-2026-draft-order-search.json`、`firecrawl-2026-mock-draft-search.json`、`firecrawl-2026-team-needs-search.json` 是当前外部爬取原始文件。
- `data/normalized/normalized_2026_mock_lottery.json` 已完成 NBA.com consensus lottery 前 14 和 10 家媒体 mock 信号。
- `data/normalized/normalized_2026_team_context.json` 已完成 NBA.com 官方 60 个 pick、30 支球队 profile 链接和球队需求初步标签。
- `data/normalized/normalized_2026_prospect_big_board.json` 已完成 30 名 2026 候选人名单；ESPN Big Board 稳定抽到前 25，后 5 用 ESPN final mock 首轮补齐。
- `data/clean/clean_prospects.json`、`data/clean/clean_teams.json`、`data/final/final_import_bundle.json` 已完成当前可导入 clean/final 数据包。
- `data/clean/official_prospect_reconciliation.json` 已完成 NBA.com 官方 Prospects / Draft Order 核对：30 名 final 候选人全部在官方 Prospects 中，首轮球队顺位校验错误 0 个。
- 后续 A2/A3/A4/A5 应优先读取这些 raw/normalized/clean 文件继续清洗；只有明显缺少官方/权威信息时才补爬。

## 2.1 当前执行状态

更新时间：2026-06-22 06:04。

已经完成：

- A0 Supervisor：已验收第一轮数据链路、官方名单双 Agent 核对、参数辩论和前端 Agent-only 锁定。
- A1/A2/A3：已完成外部来源登记、2026 mock/team/prospect normalized、clean 数据包和 final import bundle。
- A4/A5：已形成球员画像、球队需求、风险偏好和证据说明的当前版本。
- A6 + D1-D9：已完成 13 个参数辩论报告，目标框架扩展到健康、伤病、热度、价值、来源质量、Combine 和历史先验等 10 个维度。
- A7：已生成当前 `agent_balanced_board.json`，前端正在使用该 Agent board。
- A9：已完成前端重排、字体放大、GSAP 动效、30 顺位全展开、右侧证据扩展、权重隐藏、人工干预入口移除和空值 fallback 修复。

当前关键限制：

- 前端只允许查看、搜索、切换证据和导出，不允许用户导入数据、生成 board、改权重或人工换人。
- 1-30 顺位只能来自 Agent board 文件；禁止在聊天、前端、JSON、Excel 或提交模板中人工指定、替换、锁定某个球员。
- A6/A11 的结论只能是可复现参数、护栏、数据修正或重跑请求；若结论影响预测，必须由 A7 重新生成完整 board，不能手工改单个 pick。
- 权重参数只能在 Agent 内部使用，不允许出现在 UI、Evidence 或 Submission JSON。
- 所有空字段必须由 Agent 或前端 fallback 明确说明，不能返回 `null`、`undefined`、`n/a`、空列表或空标签云。
- 下一轮数据更新必须先写入 `data/`，再由 A0/A3/A10 审核，不能直接手改前端预测。

下一轮 Agent 任务：

| Agent | 下一步任务 | 输出 |
|---|---|---|
| A0 | 最终前总控验收，检查 Agent-only 规则、空值、名单、导出 | `data/reports/final_supervisor_check.md` |
| A1 | 刷新权威来源，只抓 NBA.com 和主流媒体 | `data/raw/latest_authoritative_sources.json` |
| A3 | 写自动数据审计：30 签、官方命中、重复、空值、导出完整性 | `data/reports/final_data_audit.md` |
| A6 | 把 10 因子框架转成内部评分参数，不开放前端调权 | `data/reports/final_parameter_lock.md` |
| A7 | 重跑最终 Agent board 并解释低置信 pick | `data/boards/board_final_agent_locked.json` |
| A8 | 真实里程碑题公布后生成规则和答案 | `data/final/milestone_answers.json` |
| A9 | 只做 UI 验证和导出稳定性修复，不改预测 | 前端源码和验证截图 |
| A10 | 来源可信度复核，剔除社交/自媒体噪声 | `data/reports/source_quality_audit.md` |
| A11 | 仲裁最终 board 冲突 | `data/reports/final_conflict_arbitration.md` |
| A12 | 最终 lint/build/export/GitHub 检查 | `data/reports/submission_readiness.md` |

## 3. Agent 总览

| 编号 | 角色 | 主要责任 | 关键输出 |
|---|---|---|---|
| A0 | Supervisor 总控 | 验收数据、协调冲突、最终放行 | `supervisor_report.md` |
| A1 | 数据采集 | 从网站和用户文件提取原始信息 | `raw_sources.json` |
| A2 | 数据整理 | 统一字段、命名、位置、来源格式 | `normalized_*.json` |
| A3 | 数据清洗质检 | 查缺失、重复、异常和结构合法性 | `clean_*.json`, `data_quality_report.md` |
| A4 | 球员画像 | 生成球员能力、标签、风险、证据 | `clean_prospects.json` 更新建议 |
| A5 | 球队偏好 | 研究球队需求、阶段、风险偏好 | `clean_teams.json`, `team_preference_report.md` |
| A6 | 参数优化 | 设计权重方案和调参建议 | `weight_scenarios.json`, `parameter_report.md` |
| A7 | 预测生成 | 生成多套 board 并标记争议顺位 | `boards/*.json` |
| A8 | 里程碑题 | 把真实题目转成规则和答案 | `milestone_answers.json` |
| A9 | 前端与导出 | 页面、导入导出、README 和演示 | 页面源码、导出格式 |
| A10 | 来源可信度 | 给来源和消息分级 | 来源评分表 |
| A11 | 冲突仲裁 | 整理模型、共识、球队偏好的矛盾 | `conflict_report.md` |
| A12 | 提交检查 | 最终 build/lint/导出/GitHub/grounding 检查 | `submission_notes.md` |

比赛时间紧时，最小可运行阵容是：

```text
A0 Supervisor
A1 数据采集
A2 数据整理
A3 数据清洗质检
A5 球队偏好
A6 参数优化
A9 前端与导出
```

## 4. 数据契约

### 4.1 原始来源 RawSource

A1 输出 `data/raw/raw_sources.json`。

```json
{
  "sources": [
    {
      "id": "nba-consensus-2026-001",
      "sourceName": "NBA.com",
      "url": "https://example.com",
      "sourceType": "mock_draft",
      "originLayer": "external_web",
      "collectedAt": "2026-06-23T12:30:00+08:00",
      "retrievedBy": "A1",
      "credibility": 0.95,
      "rawText": "short relevant excerpt or parsed text",
      "notes": "why this source matters"
    }
  ]
}
```

`sourceType` 建议使用：

```text
official_order
mock_draft
big_board
team_need
injury_medical
workout_news
trade_context
user_file
```

`originLayer` 建议使用：

```text
official_user_provided
external_web
agent_generated
```

当前 Agent-only 流程不使用 `manual_override` 来源层；若旧数据里出现该字段，A0 必须标记为历史产物并要求重跑 Agent board。

来源优先级：

1. `official_user_provided`：用户放入 `数据/` 的官方数据包，适合历史基准、字段映射、Combine 指标和质量校验。
2. NBA.com 官方 Web：适合 2026 draft hub、draft order、consensus mock。
3. ESPN、CBS、Yahoo、The Ringer、The Athletic、Bleacher Report：适合 2026 主流预测、big board、team fit 信号。
4. Tankathon、RealGM：只做顺位/签位归属交叉校验，不当作球员预测主来源。
5. 社交媒体、自媒体、百科：默认不进入模型输入。

### 4.2 标准化 Mock 行

A2 输出 `data/normalized/normalized_mock_data.json`。

```json
{
  "mockRows": [
    {
      "playerName": "AJ Dybantsa",
      "team": "Washington Wizards",
      "pick": 1,
      "sourceId": "nba-consensus-2026-001",
      "sourceName": "NBA.com",
      "publishedAt": "2026-06-22T00:00:00+08:00",
      "weight": 1.0
    }
  ]
}
```

### 4.3 球员 Prospect

A3/A4 最终输出 `data/clean/clean_prospects.json`。字段必须能映射到 `src/types.ts` 的 `Prospect`。

```json
{
  "id": "aj-dybantsa",
  "name": "AJ Dybantsa",
  "positions": ["SF"],
  "school": "BYU",
  "origin": "United States",
  "classYear": "Freshman",
  "height": "6'9.75\"",
  "weight": "217",
  "age": 19.4,
  "consensusRank": 1,
  "mockHeat": 99,
  "international": false,
  "roleTags": ["wing creator", "alpha scorer", "star upside"],
  "strengths": ["Elite scoring wing"],
  "risks": ["Shot selection variance"],
  "profile": {
    "shooting": 86,
    "creation": 94,
    "defense": 78,
    "athleticism": 92,
    "feel": 81,
    "size": 91,
    "upside": 98
  },
  "sourceNotes": ["NBA.com consensus: common No. 1 pick"]
}
```

### 4.4 球队 TeamProfile

A5 输出 `data/clean/clean_teams.json`。字段必须能映射到 `src/types.ts` 的 `TeamProfile`。

```json
{
  "pick": 1,
  "team": "Washington Wizards",
  "phase": "rebuild",
  "needs": ["alpha scorer", "wing creator", "defensive size"],
  "priorityTags": ["wing creator", "star upside", "two-way"],
  "riskTolerance": 84,
  "notes": "Top-pick team can prioritize ceiling over narrow positional fit."
}
```

`phase` 只能是：

```text
rebuild
accelerate
contend
asset
```

### 4.5 权重方案

A6 输出 `data/reports/weight_scenarios.json`。

```json
{
  "scenarios": [
    {
      "id": "baseline",
      "label": "balanced baseline",
      "weights": {
        "consensus": 35,
        "need": 25,
        "player": 20,
        "upside": 10,
        "intel": 10
      },
      "whenToUse": "default board before late breaking news"
    }
  ]
}
```

### 4.6 预测 Board

A7 输出 `data/boards/*.json`。结构可以直接保存 `DraftPick[]`，并额外附带 scenario 信息。

```json
{
  "scenarioId": "baseline",
  "generatedAt": "2026-06-23T18:00:00+08:00",
  "board": [],
  "disputedPicks": [
    {
      "pick": 8,
      "team": "Atlanta Hawks",
      "candidates": ["Aday Mara", "Karim Lopez"],
      "reason": "consensus-heavy and need-heavy boards disagree"
    }
  ]
}
```

### 4.7 里程碑答案

A8 输出 `data/final/milestone_answers.json`。

```json
{
  "answers": [
    {
      "id": "first-international",
      "prompt": "第一位被选中的国际球员是几顺位？",
      "type": "number",
      "answer": "15",
      "confidence": 72,
      "evidence": ["15. Aday Mara, Spain"],
      "dependsOnFields": ["prospect.international", "prospect.origin", "pick"]
    }
  ]
}
```

## 5. Supervisor 验收门槛

A0 必须检查：

1. `teams` 是否正好 30 个。
2. `prospects` 是否至少 30 个。
3. 所有 `prospect.id` 是否唯一。
4. 所有 `team.pick` 是否覆盖 1-30。
5. 每个球员是否有 `consensusRank`、`mockHeat`、`profile`、`roleTags`。
6. 每支球队是否有 `phase`、`needs`、`priorityTags`、`riskTolerance`。
7. `international`、`school`、`classYear`、`positions` 是否能支撑里程碑题。
8. 所有关键数据是否有 `sourceNotes` 或来源报告支撑。
9. `generateBoard` 输出是否正好 30 个 pick。
10. 是否没有重复球员。
11. `npm run lint` 是否通过。
12. `npm run build` 是否通过。

如果不通过，A0 必须输出：

```text
阻塞项
影响范围
应该退回给哪个 Agent
需要补什么字段或证据
```

## 6. 第一轮启动顺序

第一轮不要同时启动所有 Agent。推荐先跑：

```text
并行：
A1 数据采集
A5 球队偏好
A6 参数优化
A9 前端与导出检查

随后：
A2 数据整理
A3 数据清洗质检
A7 预测生成
A0 Supervisor
```

原因：

- A1、A5、A6、A9 互相依赖少，可以并行。
- A2/A3 必须等 A1 有原始数据后再做。
- A7 必须等 clean data 和 weights 准备好。
- A0 最后验收，也可以中途抽查。

## 7. Agent 启动提示词模板

### A1 数据采集 Agent

```text
你是 DraftOps A1 数据采集 Agent。只负责采集和记录来源，不负责预测、不负责清洗、不改源码。

任务：
1. 从指定网站、用户文件和项目现有文档中提取 NBA 2026 首轮选秀相关信息。
2. 每条信息必须记录 sourceName、url、sourceType、collectedAt、credibility、rawText、notes。
3. 输出 data/raw/raw_sources.json 和简短采集报告。

验收：
- 不少于 3 类来源：官方顺位、mock/big board、球队/新闻/用户文件。
- 所有来源都要能追溯。
- 不要编造没有来源的数据。
```

### A2 数据整理 Agent

```text
你是 DraftOps A2 数据整理 Agent。只负责把 A1 原始来源整理成统一结构，不负责最终清洗和预测。

任务：
1. 读取 data/raw/raw_sources.json。
2. 输出 normalized_mock_data.json、normalized_prospects.json、normalized_teams.json。
3. 统一球员姓名、学校、位置、顺位、来源 ID。

验收：
- 字段命名稳定。
- 同名球员要合并。
- 不确定字段必须标记 unknown，不要猜。
```

### A3 数据清洗质检 Agent

```text
你是 DraftOps A3 数据清洗质检 Agent。负责把 normalized 数据变成 DraftOps 可导入的 clean 数据。

任务：
1. 生成 clean_prospects.json 和 clean_teams.json。
2. 检查重复、缺失、异常值、位置格式、phase 合法性。
3. 输出 data_quality_report.md。

验收：
- prospects 至少 30 个。
- teams 正好 30 个。
- 所有 id 唯一。
- 能组成 { "teams": [], "prospects": [] }。
```

### A4 球员画像 Agent

```text
你是 DraftOps A4 球员画像 Agent。负责把球员信息转成 profile、roleTags、strengths、risks、sourceNotes。

任务：
1. 为每名球员补全 shooting、creation、defense、athleticism、feel、size、upside。
2. roleTags 必须使用项目统一标签。
3. risks 必须来自来源或明确说明是模型推断。

验收：
- 所有 profile 分数在 0-100。
- 每名球员至少 3 个 roleTags。
- 每名球员至少 1 条 sourceNotes。
```

### A5 球队偏好 Agent

```text
你是 DraftOps A5 球队选秀偏好 Agent。负责研究每支球队需求和选秀倾向。

任务：
1. 为 30 个 pick 生成 TeamProfile。
2. 判断 phase：rebuild、accelerate、contend、asset。
3. 输出 needs、priorityTags、riskTolerance、notes。
4. 记录交易来源 acquiredFrom。

验收：
- picks 必须覆盖 1-30。
- phase 只能使用允许值。
- needs 和 priorityTags 必须和预测算法标签体系兼容。
```

### A6 参数优化 Agent

```text
你是 DraftOps A6 参数优化 Agent。只负责权重方案，不直接改球员和球队数据。

任务：
1. 设计 baseline、consensus-heavy、team-need-heavy、late-intel-heavy 至少 4 套权重。
2. 解释每套权重适用场景和风险。
3. 给出比赛不同时间段的调参建议。

验收：
- 每套权重必须包含 consensus、need、player、upside、intel。
- 权重必须能被 A7 预测脚本和 generateBoard 使用；不得要求人工滑块或前端手动调参。
- 不得输出“把第 X 顺位换成某球员”这类人工预测结论，只能输出参数、规则、护栏和需要重跑的原因。
```

### A7 预测生成 Agent

```text
你是 DraftOps A7 预测生成 Agent。负责使用 clean 数据和权重方案生成多套 board。

任务：
1. 基于当前算法生成多套 board。
2. 标记不同权重下不一致的争议顺位。
3. 输出 board_baseline.json 等文件。

验收：
- 每套 board 正好 30 个 pick。
- 没有重复球员。
- 每个争议顺位必须说明冲突来源。
- 输出必须声明 no-manual-override：没有人工指定、人工替换或人工重排任何 pick。
```

### A8 里程碑题 Agent

```text
你是 DraftOps A8 里程碑题 Agent。真实题目公布后负责把题目转成规则和答案。

任务：
1. 读取最终 board。
2. 为每道题输出 answer、confidence、evidence、dependsOnFields。
3. 如果现有数据无法回答，明确指出缺失字段。

验收：
- 答案必须能从 final_board 推导。
- 每题必须有证据。
- 不允许脱离 board 单独猜测。
```

### A9 前端与导出 Agent

```text
你是 DraftOps A9 前端与导出 Agent。负责页面体验、只读导出和演示材料。

任务：
1. 检查 Agent-only 页面、30 顺位全展开、右侧证据完整、Export Submission、Export Brief 是否符合比赛流程。
2. 如需修改，只改 App.tsx、App.css、export.ts、README.md。
3. 不改 prediction.ts 和 seedData.ts，除非 Supervisor 批准。
4. 不允许恢复 Import Data、Generate Board、Override、Weights slider 或任何人工改变预测的入口。

验收：
- 页面能打开。
- 自动读取 public/data/final_import_bundle.json 和 public/data/agent_balanced_board.json 后能展示 Agent board。
- 导出 JSON 包含 30 picks 和里程碑答案。
- 页面和导出不能暴露权重参数、null、undefined、n/a 或空 evidence/warnings。
- npm run lint 和 npm run build 通过。
```

### A10 来源可信度 Agent

```text
你是 DraftOps A10 来源可信度 Agent。负责给来源分级。

任务：
1. 对来源按 official、major media、specialized draft site、team news、rumor 分级。
2. 输出每个 sourceId 的 credibility 建议。
3. 标记过旧、互相矛盾或低可信来源。
```

### A11 冲突仲裁 Agent

```text
你是 DraftOps A11 冲突仲裁 Agent。负责整理矛盾，不直接拍板。

任务：
1. 比较 A5 球队偏好、A6 权重方案、A7 多套 board。
2. 标记共识选择 vs 球队适配选择的冲突。
3. 输出 conflict_report.md，给 A6/A7 转成可复现参数、护栏或重跑请求；不得给人工最终选人。
```

### A12 提交检查 Agent

```text
你是 DraftOps A12 提交检查 Agent。负责最后提交前检查。

任务：
1. 运行 npm run lint。
2. 运行 npm run build。
3. 检查最终导入文件、最终 board、里程碑答案和 README。
4. 检查 GitHub 私有仓库和 push 状态。

验收：
- 所有硬性检查通过。
- 任何失败都必须写明命令、错误、阻塞影响。
```

## 8. 冲突处理规则

当 Agent 结论冲突时，不允许直接覆盖。按优先级处理：

1. 官方数据优先于第三方数据。
2. 最新可信来源优先于旧来源。
3. 多来源一致优先于单一来源。
4. 有明确球队新闻时，可以挑战 mock 共识。
5. 医疗、退选、交易等硬事实优先于模型分数。
6. 最终只能放行 A7/脚本生成的完整 Agent board；Supervisor 只能检查来源、参数、规则和文件合法性，不能人工选择球员。

冲突报告格式：

```text
顺位：
球队：
冲突类型：
候选 A：
候选 B：
支持 A 的证据：
支持 B 的证据：
影响的里程碑题：
建议 Agent 复核输入：
```

## 9. 最终交付链路

最终提交前应形成：

```text
data/final/final_import_bundle.json
data/final/final_board.json
data/final/milestone_answers.json
data/final/submission_notes.md
```

然后由 A0/A3/A7/A9 执行：

```text
同步 final_import_bundle 到 public/data
同步 Agent board 到 public/data
页面检查 30 顺位和右侧证据
Export Submission
Export Brief
```

命令检查：

```powershell
npm run lint
npm run build
```

GitHub 检查：

```text
仓库是 Private
最终代码已 push
README 说明数据、方法、AWS 架构、运行方式
提交时间早于截止时间
```

## 10. 当前任务状态

当前项目已经能 build/lint，且第二轮 Web 数据补齐已形成 `raw`、`normalized`、`clean` 和 `final` 产物。

已完成：

1. A1：确认 `数据/` 官方数据入口，并完成外部来源分层。
2. A2-Web：规范化 NBA.com consensus lottery 和 10 家媒体 mock。
3. A4-Web：整理 30 名 2026 候选人名单。
4. A5-Web：规范化 NBA.com 官方 60 pick 顺位、球队 profile 链接和需求初步标签。
5. A6：产出 4 套权重方案。
6. A9：完成前端导入导出风险审计。
7. A3-Clean：生成 `clean_prospects.json`、`clean_teams.json`、`data_quality_report.md` 和 `final_import_bundle.json`。
8. 官方核对：以 NBA.com Prospects 和 Draft Order 为准，修正 final 包基础字段和官方姓名。

下一轮优先级：

1. A2/A3：把官方历史选秀、Combine 历史、指标字典标准化，作为 profile 和质量校准增强源。
2. A4：复核 `Tarris Reed Jr.` 和 supplemental rank 26-30 的画像、标签和评分，若需要调整必须写入结构化数据后交给 A7 重跑；基础身高、年龄、学校字段已按 NBA.com 官方 Prospects 修正。
3. A5：复核 `normalized_2026_team_context.json` 中 `needs_review` 和 `unknown` 的球队需求。
4. A10：给所有 sourceId 做可信度评分，锁定哪些来源能进入下一版 final bundle。
5. A7：基于 `data/final/final_import_bundle.json` 和权重方案生成多套 board。

这轮仍不要急着重构代码。下一步先补前端导入校验，再做预测结果调参和多套 board 仲裁。
