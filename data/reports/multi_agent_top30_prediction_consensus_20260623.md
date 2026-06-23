# 多 Agent 前三十预测逻辑共识总结

更新时间：2026-06-23

范围：只讨论 NBA Draft 前 30 顺位预测逻辑、参数、数据质量和重跑验证。本文不人工指定任何顺位，不人工替换球员，不手改 board。

## 1. 总结论

几轮讨论已经形成一致意见：

1. 当前预测顺序不应人工改动。任何变动只能通过结构化字段、参数、权重、惩罚项、来源质量规则、医疗/风险护栏进入算法，再由 A7 或脚本完整重跑 1-30 board。
2. 当前官方顺位顺序已联网核对 NBA.com Draft Order，本地球队排名顺序可作为有效输入。后续重点不是改顺位表，而是修正评分逻辑和数据置信度。
3. 当前模型优点是可解释、可审计、可重跑：`generateBoard` 按 pick 顺序贪心选最高分，并从候选池移除，能保证 30 picks 和无重复。
4. 当前模型最大风险不是某一个 pick，而是结构性压缩：目标框架想要 10 因子，但代码目前仍压缩为 `consensus / need / player / upside / intel` 五因子，导致健康、来源质量、球队需求置信度、历史先验等都被揉进代理字段。
5. 任何“球队为什么偏好某类球员”的叙事，不能直接变成正向加分。它最多只能成为 `needConfidence` 的证据、诊断日志、或单向下调护栏。

## 2. 硬边界

必须遵守：

- 只负责前 30。
- 禁止人工预测、人工换人、人工调序、手改 JSON。
- 禁止输出“某队应该选某人”作为最终改动依据。
- 禁止把媒体 mock fit、记者 mock、球迷讨论或社媒内容写成球队偏好证据。
- 禁止把学校、联赛、年龄、位置偏好另开一条无审计正向 scoring channel。
- 所有建议必须落到字段、参数、系数、护栏、诊断或 A7 重跑场景。

## 3. 当前 board 状态共识

当前 `public/data/agent_balanced_board.json` 是可运行基线，但不是最终锁板：

- schema：`draftops.parameter_test_board.v2`
- 生成入口：`scripts/regenerate-board.mjs`
- 核心代码：`src/lib/prediction.ts`
- 当前权重基线：`consensus 35 / need 25 / player 20 / upside 10 / intel 10`
- board health：30 picks、无重复、平均置信度约 84
- 当前低置信热点：pick 30，confidence 约 33
- narrow-margin 热点：7、10、18、19、20、22、24
- 已知数据风险：15 个 team context 存在 `needs_review` / mixed signal / no clear need source；26-30 依赖 supplemental mock-order rows；个别 profile 为 generated/conservative。

结论：当前预测可能会在结构化护栏落地后发生变化，但变化只能由 A7 全量重跑产生，不能由人手改。

## 4. 当前算法判断

已确认的算法形态：

```text
score = weighted(consensus, need, player, upside, intel)
        - riskPenalty
        + pickValueAdjustment
```

现有 `generateBoard` 是 sequential greedy draft：

1. 按 pick 升序处理球队。
2. 对所有 remaining prospects 调用 `scoreProspect`。
3. 选最高分。
4. 从 available pool 移除该球员。
5. 继续下一个 pick。

优点：

- 可解释、可审计。
- 能避免重复球员。
- 能用 scenario 重跑。
- 已有 reach/fall、medical/risk、narrow-race、board health 等基础保护。

结构风险：

- `needConfidence` 未正式进入 need 分量门控。
- `healthAvailability` 未替代字符串 medical 嗅探。
- `sourceConfidence` 还没有稳定替代 `sourceNotes.length` 类弱代理。
- late-first / contender 组合会把 upside 权重压得过低，可能使高 upside 但有风险标签的球员在 25-30 段被结构性低估。
- narrow-margin pick 实际容易由 tiebreaker 决定，所以需要把裁决阈值和观测阈值拆开。

## 5. 四类信号的不相交映射

这是第四轮讨论最重要的共识。每类信号只能走一个通道，避免双算。

| 信号 | 允许通道 | 禁止通道 |
|---|---|---|
| media mock / major-media mock fit | `consensusRank -> getConsensusScore`，`mockHeat -> getIntelScore` | 禁止写入 `teamPreferenceEvidence`，禁止作为 `needConfidence` 证据 |
| roster need | `getNeedScore`，并受 `needConfidence` 门控 | 禁止同时作为球队偏好额外加分 |
| true teamPreferenceEvidence | 只能作为 `needConfidence` 的证据来源 | 禁止直接进入 `getNeedScore` 或另开正向 scoring channel |
| frontOfficePattern | 仅可作为 capped low-weight prior，权重上限不超过 3，且要求同 regime / 同 pick range | 禁止混入 roster need，禁止与当年 consensus 双算 |

## 6. 新字段与双算风险对照表

| 新字段/概念 | 冲突点 | 共识处理 |
|---|---|---|
| `positionPreference` | 已有 `getPositionBonus` 和 `getNeedScore` direct match，容易三重计位置 fit | 二选一：要么替代硬编码 position bonus，要么只作为 `needConfidence` 证据，不另加分 |
| `schoolPreference` | 当前无独立路径，但容易变成叙事加分 | 仅作证据或消融变量；默认不进入 scoring |
| `leaguePreference` | 当前无独立路径，但容易和来源/球员发展叙事混淆 | 仅作证据或消融变量；默认不进入 scoring |
| `agePreference` | `getUpsideScore` 已有 age bonus | 只能调整 age bonus 参数，不开第二条 age 通道 |
| `frontOfficePattern` | 若进入 need，会与 roster need 双算 | 独立 capped prior，P2 之后再考虑 |
| `sourceConfidence` | 同一 outlet 可能同时抬高 consensus 和 sourceConfidence | 聚合前按 outlet 去重；独立 outlet <= 1 时 cap 0.5；consensus 侧同源 mock 只计一次 |
| `teamPreferenceEvidence` | 若直接进 need，会和 `needConfidence` 双算 | 只支撑 `needConfidence`；`mockDerived=true` 一律拒绝 |

## 7. needConfidence 共识

`needConfidence` 只作用于 need 分量，不参与权重再归一化。

推荐公式：

```text
needContribution = W_need_norm * getNeedScore(...) * needConfidence * sequenceMultiplier
```

明确禁止：

- 禁止把 `needConfidence` 变成新的全局权重再 normalize。
- 禁止把 `needConfidence` 和 `exactNeedFamilyMismatch` 叠成第三重乘子。
- 禁止让 no-clear-need 队伍通过默认值重新获得 need 驱动。

superset enum 需生成两套表：

- baseline：较保守，未填默认约 0.7。
- strict：更严格，未填默认约 0.35。

已讨论的 strict needConfidence 档位：

| 系数 | picks |
|---:|---|
| 1.00 | 2, 4, 7, 10, 13, 15, 19, 20, 21, 22, 24, 28 |
| 0.90 | 5 |
| 0.80 | 1 |
| 0.75 | 25 |
| 0.70 | 14, 18 |
| 0.55 | 3, 16 |
| 0.45 | 12, 17 |
| 0.40 | 11 |
| 0.35 | 6, 8, 9, 23, 26, 29, 30 |
| 0.00 | 27 |

pick 27 / Boston / no-clear-need 的最终门控：

```text
disableNeedScoring = true
```

为真时必须让 `needContribution` 直接短路为 0，不读取 `needConfidence` 数值。断言必须证明是布尔短路，不是 `0.0 * needScore`。

## 8. healthAvailability 共识

当前字符串 medical / health 嗅探不足，需要结构化字段替代。

推荐分级：

| healthAvailability | 基础修正 |
|---|---:|
| green | 0 |
| yellow | -2 |
| orange | -5 |
| red | -10 |
| lateMedicalRed | -12 |

实现共识：

- 有结构化 `healthAvailability` 时，跳过旧的字符串 medical 分支，避免重复惩罚。
- 医疗惩罚可以受 phase 有界调整，但必须 capped。
- 覆盖率不足时标记 degraded，不允许锁板。
- health 在 tiebreaker 中只能作序数裁决，不能再次叠加惩罚。

## 9. sourceConfidence 共识

来源质量只做置信度和审计，不应变成另一条叙事加分。

来源分层：

- NBA.com 官方事实页、官方顺位、官方候选名单：official。
- ESPN、The Athletic、CBS、The Ringer、Yahoo 等主流媒体：major_media。
- YouTube、Reddit、Instagram、Facebook、论坛、社媒、自媒体：social_or_self，权重 0 或仅 discovery。

落地规则：

- 聚合前按 outlet 去重。
- The Athletic 在 NBA.com 转载和自身域名出现时，视为同一 outlet。
- 独立 outlet <= 1 时，`sourceConfidence` cap 0.5。
- major media mock fit 不能自动生成 `teamPreferenceEvidence`。
- `mock_fit` 必须标记 `mockDerived=true`，且不得触发 need 驱动。

## 10. tiebreaker 共识

必须拆开两个阈值：

```text
TIEBREAK_EPSILON = 0.8
NARROW_MARGIN_OBSERVABILITY_BAND = 1.25
```

含义：

- `0.8` 以内才允许 tiebreaker 裁决。
- `(0.8, 1.25]` 只记录 narrow-margin 诊断，不翻面。

tiebreaker 日志必须输出：

- `tiebreakApplied`
- `resolvedBy`
- `consensusDelta`
- needConfidence 调制后的分数
- health/source/need 的参与状态

推荐裁决顺序：

```text
sourceConfidence -> needConfidence -> health -> consensusRank
```

health 在这里是序数裁决，不是第二次惩罚。

## 11. multi-pick sequencing 共识

当前 `generateBoard` 只靠 `available.splice` 防重复球员，没有处理同队多签连续吃同类需求的问题。

落地规则：

- 增加 `multiPickSequenceGroup`。
- 同一 group 的第二签开始，如果前一签已满足某个 tag family，则对同 family 的 need 分量打折。
- 折扣只作用于 need 分量。
- 不影响 consensus / player / upside / intel。
- 输出 `sequenceDedupApplied` 和折扣值。

## 12. P0 / P1 / P2 实现边界

### P0：第一优先级

只做低风险、可审计、不会人工改 pick 的字段和短路：

- `needConfidence`
- `disableNeedScoring`
- `healthAvailability`
- `sourceConfidence`
- `TIEBREAK_EPSILON` 与 `NARROW_MARGIN_OBSERVABILITY_BAND` 拆分
- narrow-margin 诊断扩展
- pick 27 `needContribution === 0` 布尔短路断言
- no-manual-override 检查

### P1：第二优先级

做模型稳定性和来源去重：

- source outlet 去重
- sourceConfidence cap 0.5
- multiPickSequenceGroup
- baseline vs strict 双场景
- position-neutral / school-neutral / league-neutral / age-neutral 四消融
- lock-gate 报告

### P2：延后，且必须被严格审计

这些项容易把叙事变成加分，不能在第一补丁随意进入 scoring：

- `generatedProfileFlag`
- `sourceDepthDiscount`
- `roleTranslationGuardrail`
- `contenderReadinessScore`
- `frontOfficePattern`
- `upside floor`
- `needRoleFitDiscount`

如果 P2 任何项乘到分数上，统一规则是：

1. 只能单向下调，不能上调。
2. 必须 capped。
3. 触发必须写 `*Applied` 日志和 multiplier。
4. 必须进入 lock-gate scoring audit，而不是 diagnostic audit。
5. `fitScore` 未定义清楚落点前，不得进入 scoring。

`roleTranslationGuardrail` / `contenderReadinessScore` 的优先落点：

```text
needRoleFitDiscount
```

只作用于 need 分量，受 `needConfidence` 同门控，只能折扣不能加成。

## 13. neutral ablation 共识

四个消融场景进入 A7 重跑矩阵：

- position-neutral
- school-neutral
- league-neutral
- age-neutral

原始判据：

```text
changedPlayerSlots <= 2 且 Spearman rho >= 0.95
```

第四轮修正为二维判据：

| 结果 | 判定 |
|---|---|
| changedSlots <= 2 且 rho >= 0.95 | 影响小，低权保留或暂缓 |
| changedSlots > 2，但受影响 pick 有高 sourceConfidence / independent beat evidence | 高影响但可能正当，保留并审计 |
| changedSlots > 2，且受影响 pick 仅 mock 源 / sourceConfidence 低 / independent outlet <= 1 | 过度依赖，回退或降级为仅诊断 |

A7 报告必须并列输出：

- changedSlots
- Spearman rho
- 每个受影响 pick 的 sourceConfidence
- 独立 outlet 数
- 是否有 independent beat evidence

不能把“影响大”直接等同于“过拟合”。

## 14. lock-gate 共识

进入锁板前必须输出以下验证项：

- baseline vs strict 的 changedSlots。
- baseline vs strict 的 Spearman rho。
- 低置信 pick 数量和清单。
- narrow-margin 诊断清单。
- tiebreakApplied / resolvedBy。
- `pick27 needContribution === 0`，且证明来自 `disableNeedScoring` 布尔短路。
- `multiPickSequenceGroup` 只折 need，不动 consensus / player。
- sourceConfidence cap 0.5 影响名单。
- outlet 去重后独立来源分布。
- P2 scoring audit 中所有 `*Applied` 的 multiplier、次数、影响范围。
- no-manual-override 证明：未手改 board，未人工替换球员。

全局安全阈值：

```text
Spearman rho >= 0.6
changedSlots <= 8
无单通道驱动 >= 3 个翻面
```

如果触发以下任一情况，不锁板：

- healthAvailability 覆盖率不足且未标 degraded。
- no-clear-need 队伍 need 分量被默认值复活。
- mockDerived 证据进入 teamPreferenceEvidence。
- P2 乘子存在上调。
- fitScore 未定义落点却进入 scoring。
- 消融结果只按 changedSlots 单维判断，没有交叉 sourceConfidence。

## 15. 球队偏好共识

“球队偏好”不能被当作一句话解释，它必须拆成证据类型：

- roster need：进入 `getNeedScore`。
- need evidence quality：进入 `needConfidence`。
- major media mock fit：进入 consensus / intel，不进入球队偏好。
- independent beat / official / roster-contract evidence：可以支撑 `needConfidence`。
- historical front office pattern：P2 capped prior，暂缓。

前十队共识：

- top-five 主要由 consensus + upside 保护，不允许弱 need 覆盖高共识。
- picks 6、8、9 属于低 trust need，不是强球队偏好。
- pick 10 类 contender/accelerate 需要 role translation 审计，但不能变成正向即战力加分。

中段 11-20 共识：

- 最大风险是 `needs_review` 和多签位 sequencing。
- picks 18、19、20 是 narrow-margin / tiebreak 热点。
- `exactNeedFamilyMismatch` 只控制 tiebreak eligibility，不是分数乘子。

后段 21-30 共识：

- 21-24 仍主要是 consensus + need/player。
- 25-29 更依赖来源深度、contender readiness、health/source 置信度。
- pick 30 是低置信尾段残差，不代表球队偏好结论，必须通过数据和护栏复核。

## 16. 外部来源共识

可进入 sourceConfidence / consensus 的主要来源：

- NBA.com official draft order / prospect facts
- NBA.com 转 The Athletic mock
- ESPN 60-pick mock / Big Board
- CBS two-round mock / lottery fit mock
- The Ringer draft guide
- Yahoo Sports draft page

只可 discovery 或零权：

- YouTube
- Reddit
- Instagram
- Facebook
- 自媒体和论坛

任何外部来源都必须区分：

```text
evidenceType = mock_fit | independent_team_signal | official_fact | roster_contract
mockDerived = true | false
```

`mockDerived=true` 不得进入球队偏好。

## 17. 讨论平台与 Agent 状态

讨论 hub：

```text
http://127.0.0.1:4317/
discussionId = disc-mqq768tp-eaac43bc
```

关键消息：

- Codex 第四轮收敛问题：`msg-mqq8ii7l-035d4314`
- Claude 冲突对照和阻断意见：`msg-mqq8mztk-3b6d28bb`
- DeepSeek 接受阻断并升级为 pre-A7 要求：`msg-mqq8o1z4-c21d37a6`
- Codex 收敛总结：`msg-mqq8t0gb-70625271`

已完成子 Agent：

- 防偏题监督
- Devil's Advocate / 防过拟合
- top 10 team preference researcher
- 11-20 team preference researcher
- 21-30 late-first researcher
- source quality researcher

Claude 额外补充轮状态：

- `opus` + `max` 已用于主要讨论。
- 最后一轮补充被 Claude CLI session limit 拦截，提示北京时间 18:20 重置。
- 该阻断不影响当前共识，因为 Claude 关键意见已被 DeepSeek 接受并写入收敛总结。

## 18. 下一步执行建议

不建议直接改预测结果。建议顺序：

1. 把本文的防双算表作为 implementation checklist。
2. 实现 P0 字段和日志：`needConfidence`、`disableNeedScoring`、`healthAvailability`、`sourceConfidence`、双阈值 narrow-margin。
3. 实现 P1 场景和报告：baseline、strict、四消融、source outlet 去重、multi-pick sequencing。
4. 跑 A7 全量 1-30 重跑。
5. 输出 lock-gate 报告。
6. 如果 lock-gate 通过，再讨论是否进入 P2 单向折扣项。

最终原则：

```text
预测只能由 agent / 算法 / A7 重跑产生；
人只能定义数据、参数、护栏、审计和验证门；
人不能指定前三十任何顺位结果。
```
