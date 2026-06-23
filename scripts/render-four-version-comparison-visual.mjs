import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const summaryPath = resolve(rootDir, "data", "reports", "four_agent_relative_prediction_summary_20260624.json");
const htmlPath = resolve(rootDir, "data", "reports", "four_version_relative_comparison_visual_20260624.html");
const svgPath = resolve(rootDir, "data", "reports", "four_version_relative_comparison_visual_20260624.svg");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const escapeXml = escapeHtml;

const versionKeys = ["relativeOriginal", "deepseekLlm", "codexLlm", "codexAgent"];
const versionLabels = {
  relativeOriginal: "Relative Original",
  deepseekLlm: "DeepSeek LLM",
  codexLlm: "Codex LLM",
  codexAgent: "Codex Agent",
};
const cellKeys = {
  relativeOriginal: "relativeOriginal",
  deepseekLlm: "deepseekLlm",
  codexLlm: "codexLlm",
  codexAgent: "codexAgent",
};
const dissentColors = {
  relativeOriginal: "#b45309",
  deepseekLlm: "#dc2626",
  codexLlm: "#7c3aed",
  codexAgent: "#2563eb",
};
const tiePalette = ["#0f766e", "#b45309", "#7c3aed", "#dc2626"];

const normalize = (value) => String(value ?? "").trim().toLowerCase();

const getColorInfo = (row) => {
  const values = Object.fromEntries(versionKeys.map((key) => [key, row[cellKeys[key]]]));
  const groups = new Map();
  for (const key of versionKeys) {
    const normalized = normalize(values[key]);
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(key);
  }
  const sortedGroups = [...groups.entries()].sort((left, right) => right[1].length - left[1].length);
  const maxCount = sortedGroups[0][1].length;
  const tied = sortedGroups.filter((group) => group[1].length === maxCount).length > 1;
  const majorityValue = tied ? "" : sortedGroups[0][0];
  const groupColor = new Map();
  if (tied) {
    sortedGroups.forEach(([value], index) => groupColor.set(value, tiePalette[index % tiePalette.length]));
  }
  return Object.fromEntries(
    versionKeys.map((key) => {
      const value = normalize(values[key]);
      const isMajority = !tied && value === majorityValue;
      return [
        key,
        {
          value: values[key],
          color: tied ? groupColor.get(value) : isMajority ? "#111827" : dissentColors[key],
          className: tied ? "tie" : isMajority ? "majority" : "dissent",
          marker: tied ? "tie" : isMajority ? "same" : "diff",
        },
      ];
    }),
  );
};

const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const rows = summary.comparison ?? [];

const htmlRows = rows
  .map((row) => {
    const colors = getColorInfo(row);
    const rowClass = row.agreementCount === 4 ? "row-unanimous" : row.agreementCount === 3 ? "row-soft" : "row-split";
    return `<tr class="${rowClass}">
  <td class="pick">${row.pick}</td>
  <td class="team">${escapeHtml(row.team)}</td>
  ${versionKeys
    .map((key) => {
      const info = colors[key];
      return `<td class="${info.className}" style="color:${info.color}">${escapeHtml(info.value)}</td>`;
    })
    .join("\n  ")}
  <td class="agreement">${row.agreementCount}/4</td>
  <td class="plurality">${escapeHtml(row.consensusPlayer)}</td>
</tr>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DraftOps 四版相对评分预测比对</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
      background: #f8fafc;
      color: #111827;
    }
    body {
      margin: 0;
      padding: 28px;
      background: #f8fafc;
    }
    .sheet {
      max-width: 1680px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    header {
      padding: 24px 28px 18px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(180deg, #ffffff, #f9fbff);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 28px;
      letter-spacing: 0;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 14px;
      color: #475569;
    }
    .pill {
      border: 1px solid #d8e0eb;
      border-radius: 999px;
      padding: 6px 10px;
      background: #fff;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
      font-size: 13px;
      color: #334155;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .table-wrap {
      overflow: auto;
      max-height: calc(100vh - 210px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      min-width: 1260px;
    }
    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 12px 10px;
      font-weight: 700;
      border-right: 1px solid rgba(255,255,255,0.12);
    }
    tbody td {
      padding: 10px;
      border-top: 1px solid #e5e7eb;
      border-right: 1px solid #eef2f7;
      font-weight: 650;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) {
      background: #fbfdff;
    }
    .row-unanimous {
      background: #f0fdf4;
    }
    tbody tr.row-soft {
      background: #fffdf3;
    }
    tbody tr.row-split {
      background: #fff7ed;
    }
    .pick {
      width: 52px;
      text-align: right;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }
    .team {
      min-width: 190px;
      color: #0f172a;
    }
    .majority {
      color: #111827;
    }
    .dissent,
    .tie {
      font-weight: 850;
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
    }
    .agreement {
      text-align: center;
      font-weight: 900;
      color: #0f172a;
    }
    .plurality {
      color: #065f46;
    }
    .note {
      padding: 14px 28px 22px;
      color: #475569;
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
      background: #fbfdff;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header>
      <h1>四版相对评分预测直观比对</h1>
      <div class="meta">
        <span class="pill">4/4 一致：${summary.agreementDistribution["4/4"] ?? 0} 个顺位</span>
        <span class="pill">3/4 一致：${summary.agreementDistribution["3/4"] ?? 0} 个顺位</span>
        <span class="pill">2/4 分歧：${summary.agreementDistribution["2/4"] ?? 0} 个顺位</span>
        <span class="pill">校验：30 picks / 3255 reviews / 剩余 93</span>
      </div>
      <div class="legend">
        <span><i class="dot" style="background:#111827"></i>多数一致</span>
        <span><i class="dot" style="background:#dc2626"></i>DeepSeek LLM 不同</span>
        <span><i class="dot" style="background:#7c3aed"></i>Codex LLM 不同</span>
        <span><i class="dot" style="background:#2563eb"></i>Codex Agent 不同</span>
        <span><i class="dot" style="background:#b45309"></i>原始相对版不同 / 2-2 分歧组</span>
      </div>
    </header>
    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>球队</th>
            <th>Relative Original</th>
            <th>DeepSeek LLM</th>
            <th>Codex LLM</th>
            <th>Codex Agent</th>
            <th>一致度</th>
            <th>多数结果</th>
          </tr>
        </thead>
        <tbody>
${htmlRows}
        </tbody>
      </table>
    </section>
    <p class="note">颜色规则：黑色为多数一致项；彩色加下划线代表该版本与多数不一致，或该顺位为 2-2 分歧组。所有版本均通过逐顺位相对评分链条校验。</p>
  </main>
</body>
</html>
`;

const columnX = {
  pick: 28,
  team: 78,
  relativeOriginal: 300,
  deepseekLlm: 560,
  codexLlm: 810,
  codexAgent: 1060,
  agreement: 1310,
  plurality: 1410,
};
const rowHeight = 33;
const top = 150;
const width = 1650;
const height = top + rowHeight * (rows.length + 1) + 70;

const svgRows = rows
  .map((row, index) => {
    const y = top + rowHeight * (index + 1);
    const colors = getColorInfo(row);
    const bg = row.agreementCount === 4 ? "#ecfdf5" : row.agreementCount === 3 ? "#fffbeb" : "#fff7ed";
    return `<rect x="18" y="${y - 23}" width="${width - 36}" height="${rowHeight}" fill="${bg}" stroke="#e5e7eb"/>
<text x="${columnX.pick}" y="${y}" text-anchor="end" class="muted">${row.pick}</text>
<text x="${columnX.team}" y="${y}" class="team">${escapeXml(row.team)}</text>
${versionKeys
  .map((key) => `<text x="${columnX[key]}" y="${y}" fill="${colors[key].color}" class="${colors[key].className}">${escapeXml(colors[key].value)}</text>`)
  .join("\n")}
<text x="${columnX.agreement}" y="${y}" text-anchor="middle" class="agreement">${row.agreementCount}/4</text>
<text x="${columnX.plurality}" y="${y}" class="plurality">${escapeXml(row.consensusPlayer)}</text>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
  .title { font: 800 30px "Microsoft YaHei", "Segoe UI", Arial, sans-serif; fill: #0f172a; }
  .meta { font: 600 15px "Microsoft YaHei", "Segoe UI", Arial, sans-serif; fill: #475569; }
  .head { font: 800 14px "Microsoft YaHei", "Segoe UI", Arial, sans-serif; fill: #fff; }
  text { font: 700 14px "Microsoft YaHei", "Segoe UI", Arial, sans-serif; fill: #111827; }
  .muted { fill: #64748b; }
  .team { fill: #0f172a; font-weight: 800; }
  .dissent, .tie { font-weight: 900; text-decoration: underline; }
  .agreement { fill: #0f172a; font-weight: 900; }
  .plurality { fill: #065f46; font-weight: 900; }
</style>
<rect width="${width}" height="${height}" fill="#f8fafc"/>
<rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="12" fill="#fff" stroke="#dbe3ef"/>
<text x="34" y="58" class="title">四版相对评分预测直观比对</text>
<text x="34" y="88" class="meta">黑色为多数一致；彩色加下划线为不同项或 2-2 分歧组。4/4=${summary.agreementDistribution["4/4"] ?? 0}，3/4=${summary.agreementDistribution["3/4"] ?? 0}，2/4=${summary.agreementDistribution["2/4"] ?? 0}。</text>
<rect x="18" y="${top - 32}" width="${width - 36}" height="34" fill="#0f172a"/>
<text x="${columnX.pick}" y="${top - 10}" text-anchor="end" class="head">#</text>
<text x="${columnX.team}" y="${top - 10}" class="head">球队</text>
<text x="${columnX.relativeOriginal}" y="${top - 10}" class="head">Relative Original</text>
<text x="${columnX.deepseekLlm}" y="${top - 10}" class="head">DeepSeek LLM</text>
<text x="${columnX.codexLlm}" y="${top - 10}" class="head">Codex LLM</text>
<text x="${columnX.codexAgent}" y="${top - 10}" class="head">Codex Agent</text>
<text x="${columnX.agreement}" y="${top - 10}" text-anchor="middle" class="head">一致</text>
<text x="${columnX.plurality}" y="${top - 10}" class="head">多数结果</text>
${svgRows}
</svg>
`;

await mkdir(dirname(htmlPath), { recursive: true });
await Promise.all([writeFile(htmlPath, html, "utf8"), writeFile(svgPath, svg, "utf8")]);

console.log(
  JSON.stringify(
    {
      html: htmlPath,
      svg: svgPath,
      rows: rows.length,
      agreementDistribution: summary.agreementDistribution,
    },
    null,
    2,
  ),
);
