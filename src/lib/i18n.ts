export type Language = "zh" | "en";

export const UI_COPY = {
  zh: {
    brandSubtitle: "2026 NBA 选秀作战室",
    navBoard: "预测板",
    navMilestones: "里程碑",
    navAws: "AWS 架构",
    actionDeepSeek: "DeepSeek 问答",
    actionBrief: "导出简报",
    actionSubmission: "导出提交",
    languageSwitch: "English",
    languageToggleAria: "切换到英文",
    countdownClosed: "提交窗口已关闭",
    heroTitle: "官方数据驱动的选秀预测板，多智能体共识锁定。",
    loadingBoard: "正在加载官方智能体预测板...",
    appliedBoard: (label: string, teams: number, prospects: number) =>
      `智能体预测板已应用：${label} · ${teams} 支球队 · ${prospects} 名官方候选球员。`,
    fallbackBoard: "无法从 public/data 加载智能体预测板，当前启用本地种子数据兜底。",
    submissionExported: "提交 JSON 已导出。",
    briefExported: "路演简报已导出。",
    activeScenario: "当前方案",
    agentOnlyBoard: "智能体锁定预测板",
    loading: "加载中",
    translationSource: "中文名优先采用本地官方球员池/提交模板；未匹配字段保留原文。",
    officialAudit: "官方校验",
    boardConfidence: "预测置信度",
    agentControl: "智能体控制",
    riskWatch: "风险关注",
    tradedPicks: "交易签位",
    pass: "30/30 通过",
    review: "需复核",
    locked: "已锁定",
    officialAuditDetail: "NBA.com 候选人校验",
    boardConfidenceDetail: "模型平均置信度",
    agentControlDetail: "无人工覆盖",
    riskWatchDetail: "含风险说明的签位",
    tradedPicksDetail: "来自交易的签位",
    roundOne: "首轮",
    predictionBoard: "预测板",
    searchPlaceholder: "搜索球队、球员、适配",
    pick: "顺位",
    team: "球队",
    player: "球员",
    market: "共识",
    fit: "适配",
    confidence: "置信度",
    fromTeam: "来自",
    heat: "热度",
    submissionHelpers: "提交辅助",
    milestones: "里程碑",
    architecture: "架构",
    awsPlan: "AWS 方案",
    appRunner: "App Runner / ECS",
    appRunnerDetail: "Web API 与静态托管",
    storage: "S3 + DynamoDB",
    storageDetail: "数据文件与预测快照",
    bedrock: "Bedrock",
    bedrockDetail: "证据摘要与问答",
    costNote: "170 美元额度目标：批量调用模型，并缓存生成摘要。",
    roadshow: "路演",
    pitchSpine: "6 分钟讲述主线",
    pitchCopy: "问题定义 40 秒 · 数据 60 秒 · 评分方法 100 秒 · Demo 100 秒 · AWS 架构 40 秒 · 最终预测板 20 秒。",
    pickLabel: "第",
    scoreUnit: "分",
    originalPick: "原始签位",
    lockedPick: "智能体已锁定该顺位 · 禁止人工覆盖",
    consensus: "共识",
    age: "年龄",
    margin: "优势差",
    whyThisPick: "选择依据",
    evidence: "证据",
    riskNotes: "风险说明",
    teamFile: "球队档案",
    fitContext: "适配上下文",
    draftZone: "顺位区间",
    teamPhase: "球队阶段",
    riskTolerance: "风险容忍",
    tradeSlot: "签位来源",
    teamNeeds: "球队需求",
    priorityTags: "优先标签",
    playerFile: "球员档案",
    profileSignals: "画像信号",
    strengths: "优势",
    sourceNotes: "来源说明",
    runnerUpCheck: "备选复核",
    alternatives: "备选球员",
    agentMargin: "智能体分差",
    liveLlm: "实时大模型",
    deepSeekWindow: "DeepSeek 问答窗口",
    deepSeekSubtitle: "比赛问答 · 不直接改代码",
    chatIntro: (modelLabel: string) =>
      `${modelLabel} 已接入。当前 DeepSeek 可回答本次比赛相关问题，包括数据、里程碑、预测、AWS、提交和代码说明；默认按全局问题回答，只有你明确说当前顺位/这个球队/选中球员时才使用当前栏目；但不能直接修改代码、写文件或提交仓库。`,
    closeDeepSeek: "关闭 DeepSeek 窗口",
    you: "你",
    chatThinking: "分析中...",
    chatPlaceholder: "问：A1 需要哪些字段？第一顺位为什么这么选？AWS 架构怎么讲？",
    send: "发送",
    heightPending: "身高待确认",
    weightPending: "体重待确认",
    originPending: "国家/地区待确认",
    positionPending: "位置待确认",
    roleTagsPending: "智能体角色标签待确认。",
    evidenceFallback: "当前顺位没有保留证据文本。",
    riskFallback: "当前数据包没有风险标记。",
    warningFallback: "智能体没有给出阻塞性警告。",
    teamNeedsPending: "智能体球队需求待确认。",
    priorityPending: "智能体优先级上下文待确认。",
    teamNotePending: "该签位球队说明待确认。",
    strengthFallback: "当前数据包没有优势标签。",
    sourceFallback: "当前数据包没有额外来源说明。",
    noAlternativeFallback: "当前预测板没有保留备选候选。",
  },
  en: {
    brandSubtitle: "2026 NBA Draft War Room",
    navBoard: "Board",
    navMilestones: "Milestones",
    navAws: "AWS",
    actionDeepSeek: "DeepSeek",
    actionBrief: "Brief",
    actionSubmission: "Submission",
    languageSwitch: "中文",
    languageToggleAria: "Switch to Chinese",
    countdownClosed: "Submission window closed",
    heroTitle: "Official-data draft board, tuned by multi-agent debate.",
    loadingBoard: "Loading official Agent board...",
    appliedBoard: (label: string, teams: number, prospects: number) =>
      `Agent board applied: ${label} · ${teams} teams · ${prospects} official prospects.`,
    fallbackBoard: "Agent board could not be loaded from public/data. Fallback seed board is active.",
    submissionExported: "Submission JSON exported.",
    briefExported: "Markdown brief exported.",
    activeScenario: "Active scenario",
    agentOnlyBoard: "Agent-only board",
    loading: "Loading",
    translationSource: "Chinese names prioritize local official player pool/submission template; unmatched fields keep source text.",
    officialAudit: "Official Audit",
    boardConfidence: "Board Confidence",
    agentControl: "Agent Control",
    riskWatch: "Risk Watch",
    tradedPicks: "Traded Picks",
    pass: "30/30 PASS",
    review: "Review",
    locked: "Locked",
    officialAuditDetail: "NBA.com prospect gate",
    boardConfidenceDetail: "Average model confidence",
    agentControlDetail: "No manual overrides",
    riskWatchDetail: "Picks with warning notes",
    tradedPicksDetail: "Acquired-from slots",
    roundOne: "Round 1",
    predictionBoard: "Prediction Board",
    searchPlaceholder: "Search team, player, fit",
    pick: "Pick",
    team: "Team",
    player: "Player",
    market: "Market",
    fit: "Fit",
    confidence: "Confidence",
    fromTeam: "from",
    heat: "heat",
    submissionHelpers: "Submission helpers",
    milestones: "Milestones",
    architecture: "Architecture",
    awsPlan: "AWS Plan",
    appRunner: "App Runner / ECS",
    appRunnerDetail: "Web API and static serving",
    storage: "S3 + DynamoDB",
    storageDetail: "Data files and board snapshots",
    bedrock: "Bedrock",
    bedrockDetail: "Evidence summaries and Q&A",
    costNote: "$170 credit target: keep model calls batched and cache generated summaries.",
    roadshow: "Roadshow",
    pitchSpine: "6-Minute Pitch Spine",
    pitchCopy: "Problem definition 40s · data 60s · scoring method 100s · demo 100s · AWS architecture 40s · final board 20s.",
    pickLabel: "Pick",
    scoreUnit: "",
    originalPick: "Original pick",
    lockedPick: "Agent locked pick · human override disabled",
    consensus: "Consensus",
    age: "Age",
    margin: "Margin",
    whyThisPick: "Why this pick",
    evidence: "Evidence",
    riskNotes: "Risk notes",
    teamFile: "Team file",
    fitContext: "Fit Context",
    draftZone: "Draft zone",
    teamPhase: "Team phase",
    riskTolerance: "Risk tolerance",
    tradeSlot: "Trade slot",
    teamNeeds: "Team needs",
    priorityTags: "Priority tags",
    playerFile: "Player file",
    profileSignals: "Profile Signals",
    strengths: "Strengths",
    sourceNotes: "Source notes",
    runnerUpCheck: "Runner-up check",
    alternatives: "Alternatives",
    agentMargin: "Agent margin",
    liveLlm: "Live LLM",
    deepSeekWindow: "DeepSeek Window",
    deepSeekSubtitle: "Competition Q&A · no direct code edits",
    chatIntro: (modelLabel: string) =>
      `${modelLabel} is connected. This DeepSeek answers global competition questions by default and only uses the current panel when you explicitly ask about the current pick, this team, or the selected player. It cannot directly edit code, write files, or push commits.`,
    closeDeepSeek: "Close DeepSeek window",
    you: "You",
    chatThinking: "Analyzing...",
    chatPlaceholder: "Ask: what fields does A1 need? Why is this the first pick? How should I explain the AWS plan?",
    send: "Send",
    heightPending: "Height pending",
    weightPending: "Weight pending",
    originPending: "Origin pending",
    positionPending: "Position pending",
    roleTagsPending: "Agent role tags pending.",
    evidenceFallback: "No evidence text retained for this pick.",
    riskFallback: "No risk flag in current bundle.",
    warningFallback: "No blocking warning from the agent.",
    teamNeedsPending: "Agent team context pending.",
    priorityPending: "Agent priority context pending.",
    teamNotePending: "Agent team note pending for this slot.",
    strengthFallback: "No strength tag in current bundle.",
    sourceFallback: "No extra source note in current bundle.",
    noAlternativeFallback: "No alternative candidate retained by current board.",
  },
} as const;

const prospectZh: Record<string, string> = {
  "AJ Dybantsa": "AJ 迪班萨",
  "Darryn Peterson": "达林 彼得森",
  "Cameron Boozer": "卡梅隆 布泽尔",
  "Caleb Wilson": "凯莱布 威尔逊",
  "Keaton Wagler": "基顿 瓦格勒",
  "Darius Acuff Jr.": "达柳斯 阿卡夫",
  "Mikel Brown Jr.": "迈克尔 布朗",
  "Aday Mara": "阿达伊 马拉",
  "Brayden Burries": "布雷登 伯里斯",
  "Kingston Flemings": "金斯顿 弗莱明斯",
  "Nate Ament": "纳撒尼尔 阿门特",
  "Yaxel Lendeborg": "亚克塞尔 伦德伯格",
  "Karim Lopez": "卡里姆 洛佩兹",
  "Morez Johnson Jr.": "小莫雷兹 约翰逊",
  "Allen Graves": "阿伦 格雷夫斯",
  "Hannes Steinbach": "汉内斯 施泰因巴赫",
  "Chris Cenac Jr.": "克里斯 塞纳克",
  "Christian Anderson": "克里斯蒂安 安德森",
  "Labaron Philon Jr.": "小拉巴伦 菲隆",
  "Bennett Stirtz": "本内特 斯特茨",
  "Cameron Carr": "卡梅隆 卡尔",
  "Dailyn Swain": "戴林 斯温",
  "Ebuka Okorie": "埃布卡 奥科里",
  "Isaiah Evans": "以赛亚 埃文斯",
  "Koa Peat": "科阿 皮特",
  "Tarris Reed Jr.": "小塔里斯 里德",
  "Sergio De Larrea": "塞尔吉奥 德拉雷亚",
  "Meleek Thomas": "马利克 托马斯",
  "Henri Veesaar": "亨利 维萨尔",
  "Jayden Quaintance": "杰登 昆坦斯",
  "Joshua Jefferson": "约书亚 杰斐逊",
  "Sergio de Larrea": "塞尔吉奥 德拉雷亚",
  "Marc-Owen Fodzo Dada": "马克-欧文 福佐 达达",
  "Jack Kayil": "杰克 卡伊尔",
  "Mohammad Amini": "穆罕默德 阿米尼",
  "Kylan Boswell": "凯兰 博斯韦尔",
};

// Chinese team names should follow NBA China/NBA Chinese-site naming first;
// keep source-specific short names as aliases only after the official full-name keys.
const teamZh: Record<string, string> = {
  "Washington Wizards": "华盛顿奇才",
  "Utah Jazz": "犹他爵士",
  "Memphis Grizzlies": "孟菲斯灰熊",
  "Chicago Bulls": "芝加哥公牛",
  "LA Clippers": "洛杉矶快船",
  "Los Angeles Clippers": "洛杉矶快船",
  "Brooklyn Nets": "布鲁克林篮网",
  "Sacramento Kings": "萨克拉门托国王",
  "Atlanta Hawks": "亚特兰大老鹰",
  Atlanta: "亚特兰大老鹰",
  "Dallas Mavericks": "达拉斯独行侠",
  "Milwaukee Bucks": "密尔沃基雄鹿",
  "Golden State Warriors": "金州勇士",
  "Oklahoma City Thunder": "俄克拉荷马雷霆",
  "Oklahoma City": "俄克拉荷马雷霆",
  "Miami Heat": "迈阿密热火",
  "Charlotte Hornets": "夏洛特黄蜂",
  "Toronto Raptors": "多伦多猛龙",
  "San Antonio Spurs": "圣安东尼奥马刺",
  "San Antonio": "圣安东尼奥马刺",
  "Detroit Pistons": "底特律活塞",
  Detroit: "底特律活塞",
  "Philadelphia 76ers": "费城76人",
  Philadelphia: "费城76人",
  "New York Knicks": "纽约尼克斯",
  "Los Angeles Lakers": "洛杉矶湖人",
  "Denver Nuggets": "丹佛掘金",
  "Boston Celtics": "波士顿凯尔特人",
  "Minnesota Timberwolves": "明尼苏达森林狼",
  Minnesota: "明尼苏达森林狼",
  "Cleveland Cavaliers": "克利夫兰骑士",
  Cleveland: "克利夫兰骑士",
  "Indiana Pacers": "印第安纳步行者",
  Indiana: "印第安纳步行者",
  "New Orleans Pelicans": "新奥尔良鹈鹕",
  "New Orleans": "新奥尔良鹈鹕",
  "Houston Rockets": "休斯顿火箭",
  Houston: "休斯顿火箭",
  "Portland Trail Blazers": "波特兰开拓者",
  Portland: "波特兰开拓者",
  "Phoenix Suns": "菲尼克斯太阳",
  "Orlando Magic": "奥兰多魔术",
  "Phoenix via Orlando": "菲尼克斯经奥兰多转来",
  "Orlando via Phoenix": "奥兰多经菲尼克斯转来",
  "Houston via Oklahoma City": "休斯顿经俄克拉荷马雷霆转来",
  "San Antonio via Atlanta": "圣安东尼奥经亚特兰大转来",
  "Oklahoma City via Washington and Philadelphia": "俄克拉荷马雷霆经华盛顿和费城转来",
  "Oklahoma City via WAS and PHI": "俄克拉荷马雷霆经华盛顿和费城转来",
};

const schoolZh: Record<string, string> = {
  BYU: "杨百翰大学",
  Kansas: "堪萨斯大学",
  Duke: "杜克大学",
  "North Carolina": "北卡罗来纳大学",
  Illinois: "伊利诺伊大学",
  Arkansas: "阿肯色大学",
  Louisville: "路易斯维尔大学",
  Michigan: "密歇根大学",
  Arizona: "亚利桑那大学",
  Houston: "休斯顿大学",
  Tennessee: "田纳西大学",
  "New Zealand Breakers (Australia)": "新西兰破坏者（澳大利亚）",
  "New Zealand": "新西兰破坏者",
  "Santa Clara": "圣塔克拉拉大学",
  Washington: "华盛顿大学",
  "Texas Tech": "德克萨斯理工大学",
  Alabama: "阿拉巴马大学",
  Iowa: "爱荷华大学",
  Baylor: "贝勒大学",
  Texas: "德克萨斯大学",
  Stanford: "斯坦福大学",
  Connecticut: "康涅狄格大学",
  "Vallodolid (Spain)": "巴拉多利德（西班牙）",
  Valencia: "瓦伦西亚",
  "Iowa State": "爱荷华州立大学",
  Kentucky: "肯塔基大学",
  "Nancy Basket (France)": "南锡篮球（法国）",
};

const countryZh: Record<string, string> = {
  "United States": "美国",
  Spain: "西班牙",
  Mexico: "墨西哥",
  Germany: "德国",
  France: "法国",
  Estonia: "爱沙尼亚",
  Nigeria: "尼日利亚",
  Australia: "澳大利亚",
  International: "国际",
};

const positionZh: Record<string, string> = {
  G: "后卫",
  F: "前锋",
  "G-F": "后卫/前锋",
  "F-C": "前锋/中锋",
  PG: "控卫",
  SG: "分卫",
  SF: "小前锋",
  PF: "大前锋",
  C: "中锋",
};

const phaseZh: Record<string, string> = {
  rebuild: "重建",
  accelerate: "加速竞争",
  contend: "争冠",
  asset: "资产型",
};

const zoneZh: Record<string, string> = {
  "top-five": "前五顺位",
  lottery: "乐透区",
  "late-first": "首轮后段",
};

const milestonePromptEn: Record<string, string> = {
  "前 5 位是否包含国际球员？": "Do the top five include an international player?",
  "第一位被选中的国际球员是几顺位？": "What pick is the first selected international player?",
  "哪所学校贡献最多首轮秀？": "Which school contributes the most first-rounders?",
  "乐透区会有多少名后卫？": "How many guards are in the lottery?",
  "第一位中锋是几顺位？": "What pick is the first center?",
  "首轮 Freshman 数量是多少？": "How many freshmen are in the first round?",
  "首轮来自交易的顺位数量是多少？": "How many first-round picks are acquired through trades?",
};

const phraseZh: Record<string, string> = {
  "3-and-D": "三分防守型",
  "A7 Board Simulation Agent": "A7 预测板模拟智能体",
  "Age curve": "年龄曲线",
  "Age for class": "同届年龄偏大",
  "Agent board pending": "智能体预测板待加载",
  "Agent-only board": "智能体锁定预测板",
  "NBA.com official 2026 first-round order": "NBA.com 官方 2026 首轮顺位",
  "NBA.com consensus mock draft": "NBA.com 共识模拟选秀",
  "Tankathon 2026 big board": "Tankathon 2026 大榜",
  "balanced baseline": "均衡基线",
  "fallback seed": "本地种子数据兜底",
  "local fallback": "本地兜底",
  "alpha scorer": "核心得分手",
  athleticism: "运动能力",
  "Aggressive scoring": "强势得分",
  "Appears across NBA.com consensus mocks": "出现在多份 NBA.com 共识模拟中",
  "Appears in NBA.com consensus lottery boards": "出现在 NBA.com 共识乐透区预测中",
  "Appears in NBA.com consensus top-14 boards": "出现在 NBA.com 共识前 14 预测中",
  "Appears on NBA.com consensus boards": "出现在 NBA.com 共识预测中",
  "Backup center path": "替补中锋路径",
  "Bench scoring pathway": "替补得分路径",
  "Big guard passing": "大尺寸后卫传球",
  "Big guard shooting": "大尺寸后卫投射",
  "big guard": "大尺寸后卫",
  "big wing": "大尺寸侧翼",
  "bench creation": "替补创造力",
  "bench guard": "替补后卫",
  "bench scoring": "替补得分",
  "bench size": "替补尺寸",
  "center depth": "中锋深度",
  "combo guard": "双能卫",
  connector: "衔接型前锋",
  "connector forward": "衔接型前锋",
  creation: "创造力",
  "Creation scale": "创造力放大程度",
  Ceiling: "上限",
  defense: "防守",
  "Decision load": "决策负担",
  "Decision making": "决策能力",
  "Decision speed": "决策速度",
  "Defensive engagement": "防守投入度",
  "Defensive matchups": "防守对位",
  "Defensive physicality": "防守对抗",
  "Defensive position": "防守位置归属",
  "Defensive pressure": "防守压力",
  "Defensive tools": "防守工具",
  "Defensive upside": "防守上限",
  "Defensive usefulness": "防守实用性",
  "defensive activity": "防守活力",
  "defensive depth": "防守深度",
  "defensive playmaking": "防守破坏力",
  "defensive size": "防守尺寸",
  depth: "阵容深度",
  "decision maker": "决策者",
  "decision making": "决策能力",
  "Defensive events": "防守事件制造",
  "Defensive event creation": "防守事件制造",
  "developmental guard": "培养型后卫",
  "Draft-ready projection uncertainty": "即战力选秀预期不确定",
  "Draft health-risk discussion": "选秀健康风险讨论",
  "Duke pedigree": "杜克背景",
  Efficiency: "效率",
  "Elite scoring wing": "精英得分侧翼",
  "Fast decision making": "快速决策",
  feel: "球商",
  "Finishing angles": "终结角度",
  "Finishing through contact": "对抗下终结",
  "Finishing through size": "面对尺寸终结",
  "Finishing touch": "终结手感",
  "First-round tools if medicals check out": "若医疗评估通过，具备首轮工具",
  "First-round media mock inclusion": "首轮媒体模拟入选",
  "Floor spacing": "拉开空间",
  "floor spacing": "拉开空间",
  "Forward size": "前锋尺寸",
  "Frontcourt strength": "前场力量",
  Frame: "体格",
  "Frame strength": "体格力量",
  "Freshman production": "大一产出",
  finisher: "终结者",
  finishing: "终结",
  forward: "前锋",
  frontcourt: "前场",
  "frontcourt defense": "前场防守",
  "frontcourt depth": "前场深度",
  "frontcourt engine": "前场核心",
  "frontcourt scoring": "前场得分",
  "frontcourt size": "前场尺寸",
  "Guard production": "后卫产出",
  "Guard size": "后卫尺寸",
  guard: "后卫",
  "guard defense": "后卫防守",
  "guard depth": "后卫深度",
  "interior finisher": "内线终结者",
  "Interior finishing": "内线终结",
  "Interior toughness": "内线强硬度",
  "interior scorer": "内线得分手",
  "International background": "国际背景",
  "International center option": "国际中锋选择",
  "International experience": "国际比赛经验",
  "Handle pressure": "持球压力",
  international: "国际球员",
  "International big milestone candidate": "国际内线里程碑候选",
  "International milestone candidate": "国际球员里程碑候选",
  "International wing size": "国际侧翼尺寸",
  "Clean guard skill": "干净的后卫技术",
  "Jumper consistency": "跳投稳定性",
  "Late-clock handle": "回合末段持球",
  "Late-first 3-and-D fit": "首轮后段三分防守型适配",
  "Late-first international guard": "首轮后段国际后卫",
  "Late-first scoring guard": "首轮后段得分后卫",
  "Late-lottery upside": "乐透后段上限",
  "late-clock offense": "回合末段进攻",
  "lead guard": "主控后卫",
  "Lead-guard scoring": "主控得分",
  length: "臂展/尺寸",
  "Length for position": "同位置尺寸优势",
  "Level-of-competition translation": "比赛级别转换",
  "Live-dribble playmaking": "活球持球组织",
  "Long frontcourt tools": "长期前场工具",
  "long-term value": "长期价值",
  "Low-mistake frontcourt feel": "低失误前场球商",
  "Low-usage fit": "低占有率适配",
  "low-usage defense": "低占有率防守",
  maturity: "成熟度",
  "Medical review": "医疗复核",
  "Mobility in space": "空间防守移动",
  "movement shooting": "移动投射",
  "Multi-category forward production": "多维前锋产出",
  "NBA athletic translation": "NBA 运动能力转换",
  "NBA.com consensus common top-eight mention": "NBA.com 共识中常被提及为前八人选",
  "NBA.com consensus mid-first name": "NBA.com 共识首轮中段人选",
  "NBA.com consensus top-14 in several boards": "多份 NBA.com 共识榜单进入前 14",
  "NBA.com consensus top-ten range": "NBA.com 共识前十区间",
  needs_review: "需复核",
  "No seed profile match": "未匹配到种子画像",
  "Height/age/weight require manual confirmation": "身高/年龄/体重需要人工确认",
  "Generated profile should not be treated as scouted grade": "生成画像不应视为球探评分",
  "Manual scouting review required": "需要人工球探复核",
  "needs_review: generated conservative DraftOps profile from normalized source row; manual player-image/profile review required.": "需复核：已根据标准化来源行生成保守画像；需要人工复核球员图片和画像。",
  "needs_review: normalized source did not provide height; placeholder retained.": "需复核：标准化来源未提供身高，已保留占位值。",
  "needs_review: normalized source did not provide age; neutral age placeholder 22.8 used.": "需复核：标准化来源未提供年龄，已使用 22.8 的中性占位值。",
  "Offensive polish": "进攻成熟度",
  "off-ball": "无球",
  "Older forward production": "高年级前锋产出",
  "Older guard production": "高年级后卫产出",
  "Older productive forward": "高年级高产前锋",
  "On-ball creation": "持球创造",
  "Open-court flashes": "开放场地亮点",
  "Open-court play": "开放场地表现",
  pace: "节奏",
  passing: "传球",
  "Passing and rebounding": "传球和篮板",
  "Passing flashes": "传球亮点",
  "passing feel": "传球感觉",
  "Passing feel": "传球感觉",
  "Passing reads": "传球阅读",
  "paint touch": "禁区触球",
  "Perimeter shooting proof": "外线投射证明",
  "Physical forward": "强壮前锋",
  "Physical forward archetype": "强壮前锋类型",
  "physical wing": "强壮侧翼",
  "Physical rebounding": "强对抗篮板",
  "Physical stamina": "身体耐力",
  "Physical tools": "身体工具",
  "Pick-and-roll feel": "挡拆感觉",
  "Pick-and-roll pace": "挡拆节奏",
  playmaking: "组织创造",
  "Playmaking balance": "组织平衡",
  "Playmaking consistency": "组织稳定性",
  "Polished production": "成熟产出",
  "point guard depth": "控卫深度",
  "point-of-attack defense": "领防",
  "Point-of-attack pressure": "持球点施压",
  "primary guard": "主控后卫",
  "Primary creation": "主攻创造",
  "Primary creation ceiling": "主攻创造上限",
  "pull-up shooting": "持球投射",
  "Rare height": "稀有身高",
  rebounder: "篮板手",
  rebounding: "篮板",
  "Rebounding and passing feel": "篮板和传球感觉",
  "Rebounding and defense": "篮板和防守",
  "Rebounding range": "篮板覆盖范围",
  "Rim pressure": "冲框压力",
  "Rising lottery momentum": "乐透热度上升",
  "Role certainty": "角色确定性",
  "Rotation readiness": "轮换准备度",
  "ready guard": "即战力后卫",
  "rim pressure": "冲框压力",
  "rim protection": "护框",
  "rim protector": "护框者",
  shooter: "射手",
  shooting: "投射",
  "Shooting consistency": "投射稳定性",
  "Shooting off movement": "移动接球投射",
  "Shooting projection": "投射预期",
  "Shooting volume": "投射产量",
  "Shot blocking": "盖帽护框",
  "Shot creation": "投篮创造",
  "Shot discipline": "出手纪律",
  "Shot selection variance": "投篮选择波动",
  "Shotmaking guard": "投篮型后卫",
  "Size and fluidity": "尺寸和流动性",
  "Size and downhill pressure": "尺寸和冲击力",
  "Size and rebounding": "尺寸和篮板",
  "Size versus NBA length": "面对 NBA 尺寸的适应",
  "Small sample": "样本较小",
  "Speed and table setting": "速度和组织调度",
  "Scoring and passing balance": "得分与传球平衡",
  "Scoring punch": "得分爆发力",
  "Scoring versatility": "得分多样性",
  "SEC production": "东南联盟赛区产出",
  "Seven-foot size": "七尺尺寸",
  "Strong guard frame": "强壮后卫体格",
  "Strong frame": "强壮体格",
  "Strength": "力量",
  "Strength development": "力量养成",
  "Strength through contact": "对抗下力量",
  "shooting guard": "得分后卫",
  "shot creation": "投篮创造",
  "shot creator": "投篮创造者",
  "secondary ball handling": "第二持球点",
  "secondary creation": "二次创造",
  "secondary handler": "第二持球手",
  "secondary passing": "二次传导",
  "Secondary playmaking": "二次组织",
  "self creation": "自主创造",
  size: "尺寸",
  "smart guard": "聪明后卫",
  speed: "速度",
  spacing: "空间",
  "star upside": "球星上限",
  "stash optionality": "海外储备弹性",
  "stretch forward": "空间型前锋",
  "Switch defense": "换防能力",
  "Switch defense ceiling": "换防上限",
  "switchable forward": "可换防前锋",
  "Tall shooting wing": "高尺寸投射侧翼",
  "team defense": "团队防守",
  "Top-end vertical pop": "顶级垂直爆发力",
  "Touch and passing windows": "手感和传球窗口",
  "Top-pick media consensus": "媒体共识状元级",
  "Transition creation": "转换创造",
  toughness: "强硬度",
  transition: "转换进攻",
  "two-way": "攻防一体",
  "two-way guard": "双向后卫",
  "Two-way forward tools": "双向前锋工具",
  "Two-way tools": "双向工具",
  "Upside ceiling": "上限天花板",
  "Upside swing": "上限弹性",
  upside: "上限",
  "Useful low-usage fit": "有用的低占有率适配",
  "versatile forward": "多功能前锋",
  versatility: "多功能性",
  "Vertical explosiveness": "垂直爆发力",
  "vertical spacing": "垂直空间",
  "Wing shooting": "侧翼投射",
  "Wing size": "侧翼尺寸",
  wing: "侧翼",
  "wing creator": "侧翼创造者",
  "wing defender": "侧翼防守者",
  "wing depth": "侧翼深度",
  "wing shooting": "侧翼投射",
  "young guard": "年轻后卫",
  "Young for class": "同届年龄偏小",
  "fan-facing upside": "球迷关注度上限",
  "ESPN and Tankathon top guard tier": "ESPN 和 Tankathon 顶级后卫档",
  "High lottery forward archetype": "高乐透前锋类型",
  "High assist pressure": "高助攻压迫",
  "High-usage creation": "高占有率创造",
  "Half-court creation": "半场创造",
  "Half-court shot diet": "半场出手结构",
  "Houston guard with creation profile": "休斯顿大学创造型后卫画像",
  "Media momentum near top five": "媒体热度接近前五",
  "Tankathon guard group": "Tankathon 后卫组",
  "Tankathon lists him in tier 1": "Tankathon 将其列为第一档",
  "Tankathon top guard group": "Tankathon 顶级后卫组",
  "Tankathon top-tier wing": "Tankathon 顶级侧翼",
  "Tankathon top-ten wing/guard": "Tankathon 前十侧翼/后卫",
  "Tankathon first-round guard": "Tankathon 首轮后卫",
  "Tankathon first-round range": "Tankathon 首轮区间",
  "Tankathon top-15 range": "Tankathon 前 15 区间",
  "Tankathon top-20 frontcourt prospect": "Tankathon 前 20 前场候选",
  "Valued for size-shooting mix": "因尺寸和投射组合被看重",
  "Strong analytics profile": "数据画像强",
  "Clear frontcourt role": "前场角色清晰",
  "Consensus lottery name": "共识乐透人选",
  "Consensus mid-first name": "共识首轮中段人选",
  "Fits international-player milestones": "符合国际球员里程碑关注点",
  "Useful late-lottery big target": "有用的乐透后段内线目标",
  "High playmaking signal": "组织信号强",
  "Consensus fringe lottery candidate": "共识乐透边缘候选",
  "Productive guard profile": "高产后卫画像",
  "Ready guard archetype": "即战力后卫类型",
  "Ready connector forward": "即战力衔接型前锋",
  "Consensus late-lottery/mid-first": "共识乐透后段/首轮中段",
  "Conservative frontcourt role projection": "保守前场角色预测",
  "International guard option": "国际后卫选择",
  "LNB Elite development track": "法国 LNB 精英联赛培养路径",
  "Limited senior-squad sample": "一线队样本有限",
  "long-term developmental scoring guard": "长期培养型得分后卫",
  "NBA translation uncertainty": "NBA 转换不确定性",
  "Playmaking flashes": "组织亮点",
  "Scoring guard profile": "得分后卫画像",
  "U21 scoring production": "U21 得分产出",
  "NBA.com official profile: came through the SLUC Nancy youth system and represented France at the 2025 FIBA U19 Basketball World Cup.": "NBA.com 官方档案：他出自 SLUC 南锡青训体系，并代表法国参加 2025 年 FIBA U19 篮球世界杯。",
  "NBA.com official profile: 2025-26 LNB Elite line was 6.2 points in 13.8 minutes per game.": "NBA.com 官方档案：2025-26 赛季在法国 LNB 精英联赛场均 13.8 分钟得到 6.2 分。",
  "NBA.com projection: long-term developmental scoring guard; unlikely to be draft-ready in 2026.": "NBA.com 预测：长期培养型得分后卫，2026 年大概率还不是即战力选秀人选。",
  "Contending team may prefer a cleaner immediate role.": "争冠球队可能更偏好角色更清晰的即战力。",
  "Fit score is below target; verify with team-need notes.": "适配分低于目标，请结合球队需求说明复核。",
  "International milestone impact: monitor first international slot.": "可能影响国际球员里程碑，请关注首位国际球员顺位。",
  "Medical context should be checked before final lock.": "最终锁定前需要复核医疗背景。",
  "Risk penalty is material; check injury, shooting or role translation notes.": "风险扣分较高，请复核伤病、投射或角色转换说明。",
};

const localize = (value: string | null | undefined, lang: Language, dictionary: Record<string, string>) => {
  if (!value) return "";
  return lang === "zh" ? dictionary[value] ?? value : value;
};

export const localizeProspectName = (name: string, lang: Language) => localize(name, lang, prospectZh);
export const localizeTeamName = (name: string, lang: Language) => localize(name, lang, teamZh);
export const localizeSchoolName = (name: string, lang: Language) => localize(name, lang, schoolZh);
export const localizeCountryName = (name: string, lang: Language) => localize(name, lang, countryZh);
export const localizePhase = (phase: string, lang: Language) => localize(phase, lang, phaseZh);
export const localizeZone = (zone: string, lang: Language) => localize(zone, lang, zoneZh);

export const localizePhrase = (text: string, lang: Language) => {
  if (lang === "en") return text;
  return phraseZh[text] ?? phraseZh[text.trim().toLowerCase()] ?? text;
};

const classYearZh: Record<string, string> = {
  Freshman: "大一",
  Sophomore: "大二",
  Junior: "大三",
  Senior: "大四",
  International: "国际球员",
};

const signalZh: Record<string, string> = {
  fit_signal_supported: "适配信号支持",
  explicit_need_supported: "明确需求支持",
  multiple_pick_mixed_signal: "多签位混合信号",
  explicit_fit_and_asset_signal_supported: "适配与资产信号支持",
  mixed_signal_needs_review: "混合信号，需复核",
  fit_signal_needs_review: "适配信号需复核",
  asset_and_fit_signal_needs_review: "资产与适配信号需复核",
  explicit_need_with_trade_uncertainty: "明确需求，但交易背景存在不确定性",
  explicit_need_supported_from_single_source: "单一来源支持的明确需求",
  no_clear_need_source: "缺少清晰需求来源",
};

const confidenceZh: Record<string, string> = {
  high: "高",
  medium_high: "中高",
  medium: "中",
  low_medium: "中低",
  low: "低",
  unknown: "未知",
};

const tagStatusZh: Record<string, string> = {
  "usable explicit tags": "可用明确标签",
  "needs review": "需复核",
};

const leadSentenceZh: Record<string, string> = {
  "Top-pick team can prioritize ceiling over narrow positional fit.": "状元签球队可以优先考虑上限，而不是狭窄的位置适配。",
  "Needs a lead initiator who can organize young frontcourt pieces.": "需要一名能组织年轻前场核心的主控发起点。",
  "Best value is a high-floor frontcourt hub who can help quickly.": "最优价值是能快速提供帮助、下限较高的前场轴心。",
  "Roster needs size and creation more than another low-usage guard.": "阵容更需要尺寸和创造力，而不是再增加低占有率后卫。",
  "Traded pick context makes upside and trade value important.": "交易签背景让上限和交易价值更重要。",
  "Can take a creator with development runway.": "可以选择一名仍有培养周期的创造型球员。",
  "Best fit is a guard who creates easy offense without killing tempo.": "最佳适配是能制造轻松进攻、又不拖慢节奏的后卫。",
  "Pick acquired from another team gives room for a specialized big.": "来自其他球队的签位给了选择专项型内线的空间。",
  "Contending context favors a cleaner role and shooting translation.": "争冠语境更偏好角色清晰、投射转换更稳的球员。",
  "Immediate role fit matters more than a long development arc.": "即时角色适配比漫长培养周期更重要。",
  "System fit rewards processing, shooting and low-mistake play.": "体系适配更看重处理球、投射和低失误表现。",
  "Deep roster can swing on a developmental or positional luxury pick.": "阵容深度足够，可以押注发展型或位置奢侈型选择。",
  "Profile should survive demanding defensive and conditioning standards.": "该画像需要能经受高强度防守和体能标准考验。",
  "Young core benefits from a reliable interior complement.": "年轻核心会受益于可靠的内线补充。",
  "Second first-rounder can cover a different role than pick 4.": "第二个首轮签可以覆盖与第 4 顺位不同的角色。",
  "Additional pick can target depth behind established creators.": "额外签位可以补充既有创造者身后的阵容深度。",
  "Can tolerate longer development if the player protects trade value.": "如果球员能保护交易价值，就可以容忍更长培养周期。",
  "A second selection can balance earlier frontcourt value.": "第二个选择可以平衡前面已取得的前场价值。",
  "Length and multi-position defense remain the cleanest identity fit.": "臂展和多位置防守仍是最清晰的球队身份适配。",
  "Needs a guard who complements high-usage frontcourt creation.": "需要一名能搭配高占有率前场创造的后卫。",
  "Role clarity matters around existing young ball handlers.": "围绕现有年轻持球手，角色清晰度很重要。",
  "Pick should produce a rotation pathway quickly.": "该签位应尽快形成轮换路径。",
  "Second pick can chase a different skill package than pick 8.": "第二个签位可以追求与第 8 顺位不同的技能包。",
  "Late first should fit a playoff rotation role.": "首轮后段应适配季后赛轮换角色。",
  "Needs a wing who can survive high-leverage minutes.": "需要一名能扛住关键时段的侧翼。",
  "Passing and processing reduce friction in a motion-heavy offense.": "传球和处理球能降低动态进攻体系中的磨合成本。",
  "Roster context rewards players who defend multiple spots.": "阵容环境奖励能防多个位置的球员。",
  "Late pick should add guard skill without sacrificing defense.": "后段签应补充后卫技能，同时不牺牲防守。",
  "Interior insurance has a clearer path than another small guard.": "内线保险比再选一名小后卫路径更清晰。",
  "Second late pick can add a bigger creator or stash value.": "第二个后段签可以补充大尺寸创造者或储备价值。",
};

const localizeCommaList = (value: string) =>
  value
    .split(",")
    .map((item) => localizePhrase(item.trim(), "zh"))
    .join("、");

const localizeCommonSourceText = (text: string) => {
  const exact = localizePhrase(text, "zh");
  if (exact !== text) return exact;
  if (/^NBA\.com consensus: most common No\. (\d+) pick$/.test(text)) {
    return text.replace(/^NBA\.com consensus: most common No\. (\d+) pick$/, "NBA.com 共识：最常见第 $1 顺位");
  }
  if (/^NBA\.com consensus: common No\. (\d+) pick$/.test(text)) {
    return text.replace(/^NBA\.com consensus: common No\. (\d+) pick$/, "NBA.com 共识：常见第 $1 顺位");
  }
  if (/^NBA\.com consensus: common pick in ([\d-]+) range$/.test(text)) {
    return text.replace(/^NBA\.com consensus: common pick in ([\d-]+) range$/, "NBA.com 共识：常见于第 $1 顺位区间");
  }
  if (/^NBA\.com consensus (.+)$/.test(text)) {
    return text.replace(/^NBA\.com consensus (.+)$/, "NBA.com 共识：$1");
  }
  if (/^Consensus rank (\d+) vs pick (\d+); mock heat (\d+)\/100\.$/.test(text)) {
    return text.replace(/^Consensus rank (\d+) vs pick (\d+); mock heat (\d+)\/100\.$/, "共识排名第 $1，对应第 $2 顺位；模拟热度 $3/100。");
  }
  return text;
};

const localizeOfficialProfile = (text: string) => {
  const match = text.match(/^NBA\.com official prospects: ([^,]+), age (\d+), (.+), ([^,]+), ([^,]+), ([^,]+), (.+)$/);
  if (!match) return "";
  const [, position, age, school, height, weight, classYear, country] = match;
  const positionText = position
    .split("/")
    .map((part) => positionZh[part.trim()] ?? part.trim())
    .join("/");
  return `NBA.com 官方候选人：${positionText}，${age} 岁，${localizeSchoolName(school, "zh")}，${height}，${weight.replace(/\s*lbs?/i, " 磅")}，${classYearZh[classYear] ?? classYear}，${localizeCountryName(country, "zh")}`;
};

const localizeTeamNote = (text: string) => {
  const translatedLead = Object.entries(leadSentenceZh).reduce(
    (current, [source, target]) => current.replace(source, target),
    text,
  );
  return translatedLead
    .replace(/Official NBA\.com order pick (\d+), acquired from ([^.]+)\./g, (_, pick: string, team: string) => `NBA.com 官方顺位第 ${pick}，来自 ${localizeTeamName(team, "zh")}。`)
    .replace(/Official NBA\.com order pick (\d+)\./g, "NBA.com 官方顺位第 $1。")
    .replace(/Need signal: ([^;]+); confidence ([^;]+); ([^.]+)\./g, (_, signal: string, confidence: string, status: string) => {
      return `需求信号：${signalZh[signal] ?? signal}；置信度：${confidenceZh[confidence] ?? confidence}；${tagStatusZh[status] ?? status}。`;
    });
};

export const localizeEvidenceText = (text: string, lang: Language) => {
  if (lang === "en") return text;
  const officialProfile = localizeOfficialProfile(text);
  if (officialProfile) return officialProfile;
  if (leadSentenceZh[text.split(" Official NBA.com order pick")[0] + "."]) return localizeTeamNote(text);
  if (/Official NBA\.com order pick \d+/.test(text) && /Need signal:/.test(text)) return localizeTeamNote(text);
  if (/^Consensus rank \d+ vs pick \d+; mock heat \d+\/100\.$/.test(text)) return localizeCommonSourceText(text);
  if (/^\d+\. .+ from .+$/.test(text)) {
    return text.replace(/^(\d+)\. (.+) from (.+)$/, (_, pick: string, team: string, source: string) => {
      return `${pick}. ${localizeTeamName(team, "zh")} 来自 ${localizeTeamName(source, "zh")}`;
    });
  }
  if (/^Intel adjusted for consensus overlap: expected heat \d+, adjusted intel \d+\/100\.$/.test(text)) {
    return text.replace(/^Intel adjusted for consensus overlap: expected heat (\d+), adjusted intel (\d+)\/100\.$/, "情报分已扣除共识重叠：预期热度 $1，调整后情报分 $2/100。");
  }
  if (/^Risk\/value controls: \d+ risk penalty after .+ tolerance; pick-value adjustment [+-]?\d+\.$/.test(text)) {
    return text.replace(/^Risk\/value controls: (\d+) risk penalty after (.+) tolerance; pick-value adjustment ([+-]?\d+)\.$/, (_, risk: string, phase: string, value: string) => `风险/顺位价值控制：按${localizePhase(phase, "zh")}阶段容忍度后风险扣分为 ${risk}；顺位价值调整为 ${value}。`);
  }
  if (text === "Agent parameter profile locked; risk and fit adjustments applied.") {
    return "智能体参数画像已锁定；风险和适配修正已应用。";
  }
  if (/^Raw model margin over next candidate: [+-]?[\d.]+ points vs .+\.$/.test(text)) {
    return text.replace(/^Raw model margin over next candidate: ([+-]?[\d.]+) points vs (.+)\.$/, (_, margin: string, name: string) => `原始模型相对下一候选分差 ${margin} 分；对比 ${localizeProspectName(name, "zh")}。`);
  }
  if (text === "Model margin: no remaining runner-up candidate.") {
    return "模型分差：没有剩余备选候选。";
  }
  if (/^Narrow-race check: raw score led by [\d.]+ points; consensus rank \d+ over \d+ confirmed the pick\.$/.test(text)) {
    return text.replace(/^Narrow-race check: raw score led by ([\d.]+) points; consensus rank (\d+) over (\d+) confirmed the pick\.$/, "胶着顺位复核：原始分领先 $1 分；共识排名 $2 优于 $3，确认该选择。");
  }
  if (/^Narrow-race tiebreaker: raw score trailed by [\d.]+ points; consensus rank \d+ over \d+ broke the tie\.$/.test(text)) {
    return text.replace(/^Narrow-race tiebreaker: raw score trailed by ([\d.]+) points; consensus rank (\d+) over (\d+) broke the tie\.$/, "胶着顺位决胜：原始分落后 $1 分；共识排名 $2 优于 $3，打破平局。");
  }
  if (/^Team needs: .+\.$/.test(text)) {
    return text.replace(/^Team needs: (.+)\.$/, (_, needs: string) => `球队需求：${localizeCommaList(needs)}。`);
  }
  if (/^Role fit: .+; strengths: .+\.$/.test(text)) {
    return text.replace(/^Role fit: (.+); strengths: (.+)\.$/, (_, fit: string, strengths: string) => `角色适配：${localizePhrase(fit, "zh")}；优势：${localizeCommaList(strengths)}。`);
  }
  if (/^ESPN 2026 NBA draft big board top 100: normalized rank \d+; source rank \d+; confidence .+\.$/.test(text)) {
    return text.replace(/^ESPN 2026 NBA draft big board top 100: normalized rank (\d+); source rank (\d+); confidence (.+)\.$/, (_, normalized: string, source: string, confidence: string) => `ESPN 2026 NBA 选秀前 100 大榜：标准化排名第 ${normalized}；来源排名第 ${source}；置信度 ${confidenceZh[confidence] ?? confidence}。`);
  }
  if (/^ESPN 2026 NBA mock draft projecting \d+ picks: normalized rank \d+; source rank \d+; confidence .+\.$/.test(text)) {
    return text.replace(/^ESPN 2026 NBA mock draft projecting (\d+) picks: normalized rank (\d+); source rank (\d+); confidence (.+)\.$/, (_, picks: string, normalized: string, source: string, confidence: string) => `ESPN 2026 NBA 模拟选秀 ${picks} 顺位：标准化排名第 ${normalized}；来源排名第 ${source}；置信度 ${confidenceZh[confidence] ?? confidence}。`);
  }
  if (/^Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible\. ESPN mock pick \d+ to .+\.$/.test(text)) {
    return text.replace(/^Supplemental first-round candidate from ESPN final mock because ESPN Big Board ranks 26-100 were not visible\. ESPN mock pick (\d+) to (.+)\.$/, (_, pick: string, team: string) => `由于 ESPN 大榜第 26-100 名不可见，该球员按 ESPN 最终模拟选秀补充为首轮候选；ESPN 模拟第 ${pick} 顺位给 ${localizeTeamName(team, "zh")}。`);
  }
  if (/^NBA\.com consensus lottery cross-check: pick \d+, most common .+\.$/.test(text)) {
    return text.replace(/^NBA\.com consensus lottery cross-check: pick (\d+), most common (.+)\.$/, "NBA.com 共识乐透交叉核对：预测第 $1 顺位，最常见结果为 $2。");
  }
  if (/^Visible ESPN Big Board profile entry extracted from local raw markdown\./.test(text)) {
    return text
      .replace("Visible ESPN Big Board profile entry extracted from local raw markdown.", "已从本地原始文档中抽取可见 ESPN 大榜球员档案。")
      .replace("ESPN Top 100 ranks 26-100 were not exposed in local raw or supplemental scrape.", "本地原始数据和补充抓取未暴露 ESPN 前 100 大榜的第 26-100 名。")
      .replace(/^(.+) NBA\.com consensus lottery cross-check: pick (\d+), most common (.+)\.$/, "$1 NBA.com 共识乐透交叉核对：预测第 $2 顺位，最常见结果为 $3。");
  }
  if (/^Tankathon No\. \d+ range$/.test(text)) {
    return text.replace(/^Tankathon No\. (\d+) range$/, "Tankathon 第 $1 顺位附近");
  }
  return localizeCommonSourceText(text);
};

export const formatPositionsLocalized = (
  positions: string[] | null | undefined,
  lang: Language,
  fallback: string,
) => {
  const compactPositions = (positions ?? []).map((position) => position.trim()).filter(Boolean);
  if (!compactPositions.length) return fallback;
  return compactPositions.map((position) => localize(position, lang, positionZh)).join("/");
};

export const localizeMilestonePrompt = (prompt: string, lang: Language) =>
  lang === "en" ? milestonePromptEn[prompt] ?? prompt : prompt;

export const localizeMilestoneType = (type: string, lang: Language) => {
  if (lang === "en") return type.replace("_", "/");
  const map: Record<string, string> = {
    yes_no: "是否题",
    number: "数字题",
    text: "填空题",
  };
  return map[type] ?? type;
};
