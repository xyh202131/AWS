# -*- coding: utf-8 -*-
import csv
import hashlib
import json
import math
import re
import statistics
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POOL_PATH = ROOT / "data" / "normalized" / "normalized_2026_local_player_pool_124.json"
COMBINE_PATH = ROOT / "数据" / "NBA选秀大会_26-27赛季数据.xlsx"
METRIC_DICT_PATH = ROOT / "数据" / "DraftCombine_Hackathon" / "NBA_Combine_Stat_Lab_指标中英文.xlsx"
HISTORY_PATH = ROOT / "数据" / "DraftCombine_Hackathon" / "DraftCombineHistory2000_2025.csv"
OUT_JSON = ROOT / "data" / "normalized" / "normalized_2026_player_feature_reference_124.json"
OUT_MD = ROOT / "data" / "reports" / "player_feature_parameter_reference_124_20260623.md"
OUT_CSV = ROOT / "data" / "reports" / "player_feature_parameter_reference_124_20260623.csv"

CELL_RE = re.compile(r"([A-Z]+)([0-9]+)")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sha256_file(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def local_name(tag):
    return tag.split("}", 1)[-1]


def resolve_target(target):
    if not target:
        return target
    if target.startswith("/"):
        return target.lstrip("/")
    if target.startswith("xl/"):
        return target
    return f"xl/{target}"


def col_to_num(col):
    value = 0
    for char in col:
        value = value * 26 + ord(char) - 64
    return value


def cell_pos(ref):
    match = CELL_RE.match(ref or "")
    if not match:
        return None, None
    return int(match.group(2)), col_to_num(match.group(1))


def read_xlsx(path):
    workbook = {}
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            shared_xml = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for item in shared_xml.iter():
                if local_name(item.tag) == "si":
                    shared.append("".join(t.text or "" for t in item.iter() if local_name(t.tag) == "t"))

        workbook_xml = ET.fromstring(z.read("xl/workbook.xml"))
        rels_xml = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_xml if local_name(rel.tag) == "Relationship"}

        for sheet in workbook_xml.iter():
            if local_name(sheet.tag) != "sheet":
                continue
            sheet_name = sheet.attrib.get("name")
            rid = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            sheet_path = resolve_target(relmap.get(rid))
            rows = {}
            if sheet_path in names:
                sheet_xml = ET.fromstring(z.read(sheet_path))
                for cell in sheet_xml.iter():
                    if local_name(cell.tag) != "c":
                        continue
                    row_num, col_num = cell_pos(cell.attrib.get("r"))
                    if row_num is None:
                        continue
                    cell_type = cell.attrib.get("t")
                    value = None
                    if cell_type == "s":
                        v = next((child for child in cell if local_name(child.tag) == "v"), None)
                        if v is not None and v.text is not None:
                            index = int(v.text)
                            value = shared[index] if 0 <= index < len(shared) else v.text
                    elif cell_type == "inlineStr":
                        value = "".join(t.text or "" for t in cell.iter() if local_name(t.tag) == "t")
                    else:
                        v = next((child for child in cell if local_name(child.tag) == "v"), None)
                        if v is not None:
                            value = v.text
                    if value is not None and str(value).strip():
                        rows.setdefault(row_num, {})[col_num] = str(value).strip()
            workbook[sheet_name] = rows
    return workbook


def sheet_records(rows, header_row=1, data_start=None):
    if header_row not in rows:
        return []
    data_start = data_start or header_row + 1
    max_col = max(rows[header_row])
    headers = [rows[header_row].get(col, "").strip() for col in range(1, max_col + 1)]
    records = []
    for row_num in sorted(num for num in rows if num >= data_start):
        row = rows[row_num]
        record = {"_sourceRow": row_num}
        has_value = False
        for index, header in enumerate(headers, start=1):
            if not header:
                continue
            value = row.get(index, "")
            if value:
                has_value = True
            record[header] = value
        if has_value:
            records.append(record)
    return records


def to_number(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"-", "NULL", "null", "-%", "N/A"}:
        return None
    try:
        return float(text.replace("%", "").replace(",", ""))
    except ValueError:
        return None


def ft_in_to_inches(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"-", "NULL", "null"}:
        return None
    plain = to_number(text)
    if plain is not None and "'" not in text:
        return plain
    match = re.search(r"(\d+)\s*'\s*([0-9.]+)?", text)
    if not match:
        return None
    return float(match.group(1)) * 12 + float(match.group(2) or 0)


def rounded(value, digits=2):
    return None if value is None else round(float(value), digits)


def pct(made, attempts):
    made_num = to_number(made)
    attempts_num = to_number(attempts)
    if made_num is None or not attempts_num:
        return None
    return made_num / attempts_num * 100


def avg(values):
    cleaned = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    if not cleaned:
        return None
    return round(sum(cleaned) / len(cleaned), 1)


def sum_or_none(values):
    cleaned = [v for v in values if v is not None]
    return None if not cleaned else sum(cleaned)


def percentile(value, values, higher_better=True):
    if value is None:
        return None
    cleaned = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    if not cleaned:
        return None
    if higher_better:
        count = sum(1 for v in cleaned if v <= value)
    else:
        count = sum(1 for v in cleaned if v >= value)
    return round(count / len(cleaned) * 100, 1)


def position_group(position):
    text = str(position or "").upper()
    if "中锋" in text or text == "C" or "/C" in text or "C/" in text:
        return "big"
    if "后卫" in text or "PG" in text or "SG" in text or text == "G":
        return "guard"
    if "前锋" in text or "SF" in text or "PF" in text or text in {"F", "F-C", "G-F"}:
        return "forward"
    return "unknown"


def tier(score, completeness):
    if score is None or completeness < 45:
        return "D-incomplete-signal"
    if score >= 75:
        return "A-elite-parameter-reference"
    if score >= 60:
        return "B-positive-parameter-reference"
    if score >= 45:
        return "C-watch-parameter-reference"
    return "D-low-parameter-signal"


def metric_rank(records, key, higher_better=True):
    eligible = [record for record in records if record.get("derived", {}).get(key) is not None]
    eligible.sort(key=lambda record: record["derived"][key], reverse=higher_better)
    ranks = {}
    last_value = object()
    rank = 0
    for index, record in enumerate(eligible, start=1):
        value = record["derived"][key]
        if value != last_value:
            rank = index
            last_value = value
        ranks[record["poolOrdinal"]] = rank
    return ranks


def top_records(records, key, n=10, higher_better=True):
    selected = [record for record in records if record.get("derived", {}).get(key) is not None]
    selected.sort(key=lambda record: record["derived"][key], reverse=higher_better)
    return selected[:n]


def player_key(name, ordinal):
    return f"local-pool-{ordinal:03d}-{re.sub(r'\\s+', '-', name.strip())}"


def build():
    pool = json.loads(POOL_PATH.read_text(encoding="utf-8"))
    combine = read_xlsx(COMBINE_PATH)
    metrics_book = read_xlsx(METRIC_DICT_PATH)
    history_book = read_xlsx(HISTORY_PATH)

    participants = sheet_records(combine["参选人名单"])
    measurements = sheet_records(combine["人体测量数据"])
    athletics = sheet_records(combine["力量与敏捷性"])
    shootings = sheet_records(combine["投篮训练"])
    metric_records = sheet_records(metrics_book["NBA Combine指标"])
    history_rows = sheet_records(next(iter(history_book.values())), header_row=2, data_start=3)

    participant_by_name = {row.get("姓名"): row for row in participants if row.get("姓名")}
    measurement_by_name = {row.get("球员"): row for row in measurements if row.get("球员")}
    athletic_by_name = {row.get("球员"): row for row in athletics if row.get("球员")}
    shooting_by_name = {row.get("球员"): row for row in shootings if row.get("球员")}
    pool_name_counts = Counter(item["nameZh"] for item in pool["prospects"])

    current_values = defaultdict(list)
    for row in measurements:
        current_values["barefootHeightIn"].append(ft_in_to_inches(row.get("无鞋身高")))
        current_values["weightLbs"].append(to_number(row.get("体重(磅)")))
        current_values["wingspanIn"].append(ft_in_to_inches(row.get("臂展")))
        current_values["standingReachIn"].append(ft_in_to_inches(row.get("摸高")))
        current_values["handLengthIn"].append(to_number(row.get("手长(英寸)")))
        current_values["handWidthIn"].append(to_number(row.get("手宽(英寸)")))
    for row in athletics:
        current_values["laneAgilitySec"].append(to_number(row.get("罚球区灵敏度(秒)")))
        current_values["shuttleRunSec"].append(to_number(row.get("折返跑(秒)")))
        current_values["sprintSec"].append(to_number(row.get("3/4场冲刺(秒)")))
        current_values["noStepVerticalIn"].append(to_number(row.get("原地弹跳(英寸)")))
        current_values["maxVerticalIn"].append(to_number(row.get("助跑弹跳(英寸)")))
        current_values["benchPressReps"].append(to_number(row.get("卧推次数")))
    for row in shootings:
        total_made = sum_or_none([to_number(row.get(key)) for key in ["运球投篮命中", "定点投篮命中", "三分定点命中", "中距离定点命中", "三分侧翼命中", "中距离侧翼命中", "罚球命中"]])
        total_attempts = sum_or_none([to_number(row.get(key)) for key in ["运球投篮出手", "定点投篮出手", "三分定点出手", "中距离定点出手", "三分侧翼出手", "中距离侧翼出手", "罚球出手"]])
        component_pcts = [
            pct(row.get("运球投篮命中"), row.get("运球投篮出手")),
            pct(row.get("定点投篮命中"), row.get("定点投篮出手")),
            pct(row.get("三分定点命中"), row.get("三分定点出手")),
            pct(row.get("三分侧翼命中"), row.get("三分侧翼出手")),
            pct(row.get("罚球命中"), row.get("罚球出手")),
        ]
        current_values["shootingAggregatePct"].append(total_made / total_attempts * 100 if total_made is not None and total_attempts else None)
        current_values["shootingComponentAvgPct"].append(avg(component_pcts))

    historical_map = {
        "barefootHeightIn": ("Player_height_NoShoes", True),
        "weightLbs": ("Weight", True),
        "wingspanIn": ("Wingspan_inches", True),
        "standingReachIn": ("Standing_reach_inches", True),
        "handLengthIn": ("Hand_height_inches", True),
        "handWidthIn": ("Hand_width_inches", True),
        "laneAgilitySec": ("Lane_agility_drill", False),
        "sprintSec": ("Three_quarter_court_sprint", False),
        "noStepVerticalIn": ("Nostep_vertical_jump_inches", True),
        "maxVerticalIn": ("Maximum_vertical_jump_inches", True),
        "benchPressReps": ("Bench_press_repetitions", True),
    }
    history_values = defaultdict(list)
    for row in history_rows:
        for metric, (field, _) in historical_map.items():
            history_values[metric].append(to_number(row.get(field)))

    players = []
    for item in pool["prospects"]:
        name = item["nameZh"]
        participant = participant_by_name.get(name)
        measurement = measurement_by_name.get(name)
        athletic = athletic_by_name.get(name)
        shooting = shooting_by_name.get(name)

        barefoot = ft_in_to_inches(measurement.get("无鞋身高")) if measurement else None
        weight = to_number(measurement.get("体重(磅)")) if measurement else None
        wingspan = ft_in_to_inches(measurement.get("臂展")) if measurement else None
        standing_reach = ft_in_to_inches(measurement.get("摸高")) if measurement else None
        hand_length = to_number(measurement.get("手长(英寸)")) if measurement else None
        hand_width = to_number(measurement.get("手宽(英寸)")) if measurement else None
        body_fat = to_number(measurement.get("体脂率")) if measurement else None

        lane = to_number(athletic.get("罚球区灵敏度(秒)")) if athletic else None
        shuttle = to_number(athletic.get("折返跑(秒)")) if athletic else None
        sprint = to_number(athletic.get("3/4场冲刺(秒)")) if athletic else None
        no_step = to_number(athletic.get("原地弹跳(英寸)")) if athletic else None
        max_vertical = to_number(athletic.get("助跑弹跳(英寸)")) if athletic else None
        bench = to_number(athletic.get("卧推次数")) if athletic else None

        shooting_components = {}
        if shooting:
            component_fields = {
                "offDribble": ("运球投篮命中", "运球投篮出手"),
                "spotUp": ("定点投篮命中", "定点投篮出手"),
                "stationaryThree": ("三分定点命中", "三分定点出手"),
                "stationaryMidrange": ("中距离定点命中", "中距离定点出手"),
                "wingThree": ("三分侧翼命中", "三分侧翼出手"),
                "wingMidrange": ("中距离侧翼命中", "中距离侧翼出手"),
                "freeThrow": ("罚球命中", "罚球出手"),
            }
            for key, (made_field, attempt_field) in component_fields.items():
                made = to_number(shooting.get(made_field))
                attempts = to_number(shooting.get(attempt_field))
                shooting_components[key] = {
                    "made": rounded(made, 0) if made is not None else None,
                    "attempts": rounded(attempts, 0) if attempts is not None else None,
                    "pct": rounded(made / attempts * 100, 1) if made is not None and attempts else None,
                }
        total_made = sum_or_none([component["made"] for component in shooting_components.values()]) if shooting_components else None
        total_attempts = sum_or_none([component["attempts"] for component in shooting_components.values()]) if shooting_components else None
        three_made = sum_or_none([shooting_components.get("stationaryThree", {}).get("made"), shooting_components.get("wingThree", {}).get("made")]) if shooting_components else None
        three_attempts = sum_or_none([shooting_components.get("stationaryThree", {}).get("attempts"), shooting_components.get("wingThree", {}).get("attempts")]) if shooting_components else None
        shooting_aggregate_pct = total_made / total_attempts * 100 if total_made is not None and total_attempts else None
        three_pct = three_made / three_attempts * 100 if three_made is not None and three_attempts else None

        wingspan_delta = wingspan - barefoot if wingspan is not None and barefoot is not None else None
        standing_plus_max = standing_reach + max_vertical if standing_reach is not None and max_vertical is not None else None
        bmi_proxy = weight / (barefoot * barefoot) * 703 if weight is not None and barefoot else None

        current_percentiles = {
            "barefootHeight": percentile(barefoot, current_values["barefootHeightIn"], True),
            "weight": percentile(weight, current_values["weightLbs"], True),
            "wingspan": percentile(wingspan, current_values["wingspanIn"], True),
            "standingReach": percentile(standing_reach, current_values["standingReachIn"], True),
            "handLength": percentile(hand_length, current_values["handLengthIn"], True),
            "handWidth": percentile(hand_width, current_values["handWidthIn"], True),
            "laneAgility": percentile(lane, current_values["laneAgilitySec"], False),
            "shuttleRun": percentile(shuttle, current_values["shuttleRunSec"], False),
            "sprint": percentile(sprint, current_values["sprintSec"], False),
            "noStepVertical": percentile(no_step, current_values["noStepVerticalIn"], True),
            "maxVertical": percentile(max_vertical, current_values["maxVerticalIn"], True),
            "benchPress": percentile(bench, current_values["benchPressReps"], True),
            "shootingAggregate": percentile(shooting_aggregate_pct, current_values["shootingAggregatePct"], True),
            "shootingComponentAverage": percentile(avg([component.get("pct") for component in shooting_components.values()]) if shooting_components else None, current_values["shootingComponentAvgPct"], True),
        }
        historical_percentiles = {}
        value_by_metric = {
            "barefootHeightIn": barefoot,
            "weightLbs": weight,
            "wingspanIn": wingspan,
            "standingReachIn": standing_reach,
            "handLengthIn": hand_length,
            "handWidthIn": hand_width,
            "laneAgilitySec": lane,
            "sprintSec": sprint,
            "noStepVerticalIn": no_step,
            "maxVerticalIn": max_vertical,
            "benchPressReps": bench,
        }
        for metric, (_, higher_better) in historical_map.items():
            historical_percentiles[metric] = percentile(value_by_metric.get(metric), history_values[metric], higher_better)

        coverage = {
            "playerPool": True,
            "participantProfile": participant is not None,
            "anthropometric": measurement is not None,
            "athleticAgility": athletic is not None,
            "shootingDrill": shooting is not None,
        }
        completeness = 25 + (15 if participant else 0) + (25 if measurement else 0) + (20 if athletic else 0) + (15 if shooting else 0)
        physical_score = avg([current_percentiles["barefootHeight"], current_percentiles["wingspan"], current_percentiles["standingReach"], current_percentiles["handLength"]])
        explosiveness_score = avg([current_percentiles["noStepVertical"], current_percentiles["maxVertical"]])
        agility_score = avg([current_percentiles["laneAgility"], current_percentiles["shuttleRun"], current_percentiles["sprint"]])
        shooting_score = avg([current_percentiles["shootingAggregate"], current_percentiles["shootingComponentAverage"], shooting_components.get("freeThrow", {}).get("pct") if shooting_components else None])
        reference_score = round(
            (physical_score or 0) * 0.28
            + (explosiveness_score or 0) * 0.20
            + (agility_score or 0) * 0.20
            + (shooting_score or 0) * 0.22
            + completeness * 0.10,
            1,
        )

        tags = []
        if wingspan_delta is not None and wingspan_delta >= 5:
            tags.append("超长臂展")
        if standing_reach is not None and standing_reach >= 108:
            tags.append("高摸高")
        if max_vertical is not None and max_vertical >= 40:
            tags.append("顶级助跑弹跳")
        if no_step is not None and no_step >= 32:
            tags.append("强原地爆发")
        if sprint is not None and sprint <= 3.1:
            tags.append("冲刺快")
        if lane is not None and lane <= 10.9:
            tags.append("灵敏度好")
        if shooting_aggregate_pct is not None and shooting_aggregate_pct >= 60:
            tags.append("投篮训练高效")
        if three_pct is not None and three_pct >= 55:
            tags.append("三分训练高效")
        if participant and participant.get("年级") == "大一":
            tags.append("低年级")
        if item.get("countryRegionZh") not in ("美国", "-", ""):
            tags.append("国际/非美国地区")
        if completeness < 60:
            tags.append("数据不足")
        if pool_name_counts[name] > 1:
            tags.append("源表重复姓名需人工确认")

        notes = []
        if pool_name_counts[name] > 1:
            notes.append("Local answer-card pool has duplicate name rows; combine metrics are name-matched and require row-level review.")
        if item.get("schoolClubZh") == "-" or item.get("countryRegionZh") == "-":
            notes.append("Player-pool row contains dash placeholders for school/country fields.")
        if completeness < 60:
            notes.append("Reference score is low-signal because one or more 2026 data sheets did not include this player.")

        players.append({
            "poolOrdinal": item["ordinal"],
            "nameZh": name,
            "stablePlayerKey": player_key(name, item["ordinal"]),
            "sourceRows": {
                "playerPool": item.get("sourceRow"),
                "participantProfile": participant.get("_sourceRow") if participant else None,
                "anthropometric": measurement.get("_sourceRow") if measurement else None,
                "athleticAgility": athletic.get("_sourceRow") if athletic else None,
                "shootingDrill": shooting.get("_sourceRow") if shooting else None,
            },
            "baseProfile": {
                "positionZh": item.get("positionZh"),
                "positionGroup": position_group(item.get("positionZh")),
                "schoolClubZh": item.get("schoolClubZh"),
                "countryRegionZh": item.get("countryRegionZh"),
                "age": to_number(participant.get("年龄")) if participant else None,
                "classYearZh": participant.get("年级") if participant else None,
                "participantPositionZh": participant.get("位置") if participant else None,
                "participantSchoolClubZh": participant.get("学校/俱乐部") if participant else None,
                "participantCountryRegionZh": participant.get("国家/地区") if participant else None,
            },
            "measurements": {
                "positionCode": measurement.get("位置") if measurement else None,
                "barefootHeightText": measurement.get("无鞋身高") if measurement else None,
                "barefootHeightIn": rounded(barefoot),
                "weightLbs": rounded(weight, 1),
                "wingspanText": measurement.get("臂展") if measurement else None,
                "wingspanIn": rounded(wingspan),
                "standingReachText": measurement.get("摸高") if measurement else None,
                "standingReachIn": rounded(standing_reach),
                "handLengthIn": rounded(hand_length),
                "handWidthIn": rounded(hand_width),
                "bodyFatPct": rounded(body_fat),
            },
            "athleticAgility": {
                "positionCode": athletic.get("位置") if athletic else None,
                "laneAgilitySec": rounded(lane),
                "shuttleRunSec": rounded(shuttle),
                "sprintSec": rounded(sprint),
                "noStepVerticalIn": rounded(no_step),
                "maxVerticalIn": rounded(max_vertical),
                "benchPressReps": rounded(bench, 0) if bench is not None else None,
            },
            "shootingDrill": {
                "positionCode": shooting.get("位置") if shooting else None,
                "components": shooting_components,
                "totalMade": rounded(total_made, 0) if total_made is not None else None,
                "totalAttempts": rounded(total_attempts, 0) if total_attempts is not None else None,
                "aggregatePct": rounded(shooting_aggregate_pct, 1),
                "threeMade": rounded(three_made, 0) if three_made is not None else None,
                "threeAttempts": rounded(three_attempts, 0) if three_attempts is not None else None,
                "threePct": rounded(three_pct, 1),
            },
            "derived": {
                "wingspanMinusBarefootHeightIn": rounded(wingspan_delta),
                "standingReachPlusMaxVerticalIn": rounded(standing_plus_max),
                "bmiProxy": rounded(bmi_proxy, 1),
                "dataCompletenessScore": completeness,
                "physicalToolsScore": physical_score,
                "explosivenessScore": explosiveness_score,
                "agilitySpeedScore": agility_score,
                "shootingDrillScore": shooting_score,
                "referenceScore": reference_score,
                "referenceTier": tier(reference_score, completeness),
                "tags": tags,
            },
            "percentilesCurrentClass": current_percentiles,
            "percentilesHistoricalCombine": historical_percentiles,
            "sourceCoverage": coverage,
            "notes": notes,
        })

    wingspan_deltas = [player["derived"]["wingspanMinusBarefootHeightIn"] for player in players if player["derived"]["wingspanMinusBarefootHeightIn"] is not None]
    for player in players:
        player["percentilesCurrentClass"]["wingspanDelta"] = percentile(player["derived"]["wingspanMinusBarefootHeightIn"], wingspan_deltas, True)
        player["derived"]["maxVerticalIn"] = player["athleticAgility"]["maxVerticalIn"]
        player["derived"]["sprintSec"] = player["athleticAgility"]["sprintSec"]
        player["derived"]["shootingAggregatePct"] = player["shootingDrill"]["aggregatePct"]

    rank_specs = {
        "referenceScore": True,
        "physicalToolsScore": True,
        "explosivenessScore": True,
        "agilitySpeedScore": True,
        "shootingDrillScore": True,
        "wingspanMinusBarefootHeightIn": True,
        "maxVerticalIn": True,
        "sprintSec": False,
        "shootingAggregatePct": True,
    }
    ranks = {key: metric_rank(players, key, higher_better) for key, higher_better in rank_specs.items()}
    for player in players:
        player["ranksWithinPool"] = {key: ranks[key].get(player["poolOrdinal"]) for key in rank_specs}

    coverage_counts = {
        key: sum(1 for player in players if player["sourceCoverage"][key])
        for key in ["participantProfile", "anthropometric", "athleticAgility", "shootingDrill"]
    }
    full_combine_count = sum(1 for player in players if player["sourceCoverage"]["anthropometric"] and player["sourceCoverage"]["athleticAgility"] and player["sourceCoverage"]["shootingDrill"])
    complete_all_count = sum(1 for player in players if all(player["sourceCoverage"].values()))
    pool_names = {player["nameZh"] for player in players}
    sheet_names = {
        "participantProfile": set(participant_by_name),
        "anthropometric": set(measurement_by_name),
        "athleticAgility": set(athletic_by_name),
        "shootingDrill": set(shooting_by_name),
    }
    missing_by_sheet = {key: sorted(pool_names - values) for key, values in sheet_names.items()}
    extra_sheet_names = {key: sorted(values - pool_names) for key, values in sheet_names.items()}

    position_counts = Counter(player["baseProfile"]["positionZh"] for player in players)
    position_group_counts = Counter(player["baseProfile"]["positionGroup"] for player in players)
    country_counts = Counter(player["baseProfile"]["countryRegionZh"] for player in players)
    school_counts = Counter(player["baseProfile"]["schoolClubZh"] for player in players)
    class_counts = Counter(player["baseProfile"]["classYearZh"] for player in players if player["baseProfile"]["classYearZh"])
    reference_tiers = Counter(player["derived"]["referenceTier"] for player in players)
    tag_counts = Counter(tag for player in players for tag in player["derived"]["tags"])

    def row_ref(player, metric_label, metric_value):
        return {
            "poolOrdinal": player["poolOrdinal"],
            "nameZh": player["nameZh"],
            "positionZh": player["baseProfile"]["positionZh"],
            "schoolClubZh": player["baseProfile"]["schoolClubZh"],
            "countryRegionZh": player["baseProfile"]["countryRegionZh"],
            "metric": metric_label,
            "metricValue": metric_value,
            "referenceScore": player["derived"]["referenceScore"],
            "referenceTier": player["derived"]["referenceTier"],
            "tags": player["derived"]["tags"],
        }

    highlight_lists = {
        "topReferenceScore": [row_ref(player, "参数参考分", player["derived"]["referenceScore"]) for player in top_records(players, "referenceScore", 12, True)],
        "topPhysicalTools": [row_ref(player, "身体工具分", player["derived"]["physicalToolsScore"]) for player in top_records(players, "physicalToolsScore", 10, True)],
        "topExplosiveness": [row_ref(player, "爆发力分", player["derived"]["explosivenessScore"]) for player in top_records(players, "explosivenessScore", 10, True)],
        "topAgilitySpeed": [row_ref(player, "敏捷速度分", player["derived"]["agilitySpeedScore"]) for player in top_records(players, "agilitySpeedScore", 10, True)],
        "topShootingDrill": [row_ref(player, "投篮训练分", player["derived"]["shootingDrillScore"]) for player in top_records(players, "shootingDrillScore", 10, True)],
        "longestWingspanDelta": [row_ref(player, "臂展-裸足身高", player["derived"]["wingspanMinusBarefootHeightIn"]) for player in top_records(players, "wingspanMinusBarefootHeightIn", 10, True)],
        "maxVerticalTop": [row_ref(player, "助跑弹跳", player["derived"]["maxVerticalIn"]) for player in top_records(players, "maxVerticalIn", 10, True)],
        "fastestSprint": [row_ref(player, "3/4场冲刺", player["derived"]["sprintSec"]) for player in top_records(players, "sprintSec", 10, False)],
        "bestShootingAggregate": [row_ref(player, "综合投篮命中率", player["derived"]["shootingAggregatePct"]) for player in top_records(players, "shootingAggregatePct", 10, True)],
    }

    metric_dictionary = [
        {"englishMetricName": row.get("English Metric Name"), "meaningZh": row.get("中文含义"), "unit": row.get("单位")}
        for row in metric_records
        if row.get("English Metric Name") or row.get("中文含义")
    ]

    score_values = [player["derived"]["referenceScore"] for player in players if player["derived"]["referenceScore"] is not None]
    payload = {
        "schemaVersion": "draftops.player_feature_reference_124.v1",
        "generatedAt": now_iso(),
        "generatedBy": "scripts/build-player-feature-reference.py",
        "scope": "124-player local answer-card pool enriched with 2026 participant, anthropometric, athletic/agility, shooting drill data and 2000-2025 historical Combine percentiles where available.",
        "sources": {
            "playerPool": {"path": "data/normalized/normalized_2026_local_player_pool_124.json", "sha256": sha256_file(POOL_PATH)},
            "combine2026Workbook": {"path": "数据/NBA选秀大会_26-27赛季数据.xlsx", "sha256": sha256_file(COMBINE_PATH)},
            "metricDictionary": {"path": "数据/DraftCombine_Hackathon/NBA_Combine_Stat_Lab_指标中英文.xlsx", "sha256": sha256_file(METRIC_DICT_PATH)},
            "historicalCombine": {"path": "数据/DraftCombine_Hackathon/DraftCombineHistory2000_2025.csv", "sha256": sha256_file(HISTORY_PATH)},
        },
        "validation": {
            "expectedPlayerPoolCount": 124,
            "actualPlayerPoolCount": len(players),
            "participantRows": len(participants),
            "anthropometricRows": len(measurements),
            "athleticAgilityRows": len(athletics),
            "shootingRows": len(shootings),
            "historicalRows": len(history_rows),
            "matchedCoverageCounts": coverage_counts,
            "fullCombineSheetCoverageCount": full_combine_count,
            "completeAllSourceCoverageCount": complete_all_count,
            "duplicatePoolNames": [name for name, count in pool_name_counts.items() if count > 1],
            "extraSheetNamesNotInPool": extra_sheet_names,
            "missingPoolNamesBySheet": missing_by_sheet,
        },
        "modelNotes": {
            "referenceScoreMeaning": "0-100 descriptive parameter score for scouting-reference triage only. It is not a final draft prediction score. Missing modules contribute 0 to avoid over-ranking thin profiles.",
            "referenceScoreWeights": {
                "physicalToolsScore": 0.28,
                "explosivenessScore": 0.20,
                "agilitySpeedScore": 0.20,
                "shootingDrillScore": 0.22,
                "dataCompletenessScore": 0.10,
            },
            "percentileRule": "Current-class percentiles compare against available 2026 Combine rows. Historical percentiles compare against 2000-2025 Combine rows for matching metrics. Lower timed-drill values are better.",
            "dataBoundary": "No missing metric is inferred. Duplicate Chinese names are retained as separate answer-card rows and flagged.",
        },
        "summary": {
            "positionCounts": dict(position_counts),
            "positionGroupCounts": dict(position_group_counts),
            "countryRegionCountsTop": dict(country_counts.most_common(20)),
            "schoolClubCountsTop": dict(school_counts.most_common(20)),
            "classYearCounts": dict(class_counts),
            "averageReferenceScoreAvailable": rounded(statistics.mean(score_values), 1) if score_values else None,
            "referenceTierCounts": dict(reference_tiers),
            "tagCountsTop": dict(tag_counts.most_common(20)),
        },
        "highlightLists": highlight_lists,
        "metricDictionary": metric_dictionary,
        "players": players,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(players)
    write_markdown(payload, players, coverage_counts, full_combine_count, complete_all_count, missing_by_sheet, position_counts, position_group_counts, country_counts, school_counts, class_counts, reference_tiers)

    print(json.dumps({
        "json": str(OUT_JSON),
        "csv": str(OUT_CSV),
        "md": str(OUT_MD),
        "players": len(players),
        "coverage": coverage_counts,
        "fullCombineSheetCoverageCount": full_combine_count,
        "duplicatePoolNames": payload["validation"]["duplicatePoolNames"],
        "topReference": [(p["poolOrdinal"], p["nameZh"], p["derived"]["referenceScore"]) for p in top_records(players, "referenceScore", 5, True)],
    }, ensure_ascii=False, indent=2))


def write_csv(players):
    fields = [
        "poolOrdinal", "nameZh", "positionZh", "positionGroup", "age", "classYearZh", "schoolClubZh", "countryRegionZh",
        "dataCompletenessScore", "referenceScore", "referenceTier", "tags",
        "barefootHeightIn", "weightLbs", "wingspanIn", "wingspanMinusBarefootHeightIn", "standingReachIn", "handLengthIn", "handWidthIn",
        "laneAgilitySec", "shuttleRunSec", "sprintSec", "noStepVerticalIn", "maxVerticalIn", "benchPressReps",
        "shootingAggregatePct", "threePct", "freeThrowPct", "physicalToolsScore", "explosivenessScore", "agilitySpeedScore", "shootingDrillScore",
        "rankReference", "rankPhysical", "rankExplosiveness", "rankAgility", "rankShooting", "notes",
    ]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for p in players:
            writer.writerow({
                "poolOrdinal": p["poolOrdinal"],
                "nameZh": p["nameZh"],
                "positionZh": p["baseProfile"]["positionZh"],
                "positionGroup": p["baseProfile"]["positionGroup"],
                "age": p["baseProfile"]["age"],
                "classYearZh": p["baseProfile"]["classYearZh"],
                "schoolClubZh": p["baseProfile"]["schoolClubZh"],
                "countryRegionZh": p["baseProfile"]["countryRegionZh"],
                "dataCompletenessScore": p["derived"]["dataCompletenessScore"],
                "referenceScore": p["derived"]["referenceScore"],
                "referenceTier": p["derived"]["referenceTier"],
                "tags": ";".join(p["derived"]["tags"]),
                "barefootHeightIn": p["measurements"]["barefootHeightIn"],
                "weightLbs": p["measurements"]["weightLbs"],
                "wingspanIn": p["measurements"]["wingspanIn"],
                "wingspanMinusBarefootHeightIn": p["derived"]["wingspanMinusBarefootHeightIn"],
                "standingReachIn": p["measurements"]["standingReachIn"],
                "handLengthIn": p["measurements"]["handLengthIn"],
                "handWidthIn": p["measurements"]["handWidthIn"],
                "laneAgilitySec": p["athleticAgility"]["laneAgilitySec"],
                "shuttleRunSec": p["athleticAgility"]["shuttleRunSec"],
                "sprintSec": p["athleticAgility"]["sprintSec"],
                "noStepVerticalIn": p["athleticAgility"]["noStepVerticalIn"],
                "maxVerticalIn": p["athleticAgility"]["maxVerticalIn"],
                "benchPressReps": p["athleticAgility"]["benchPressReps"],
                "shootingAggregatePct": p["shootingDrill"]["aggregatePct"],
                "threePct": p["shootingDrill"]["threePct"],
                "freeThrowPct": p["shootingDrill"]["components"].get("freeThrow", {}).get("pct"),
                "physicalToolsScore": p["derived"]["physicalToolsScore"],
                "explosivenessScore": p["derived"]["explosivenessScore"],
                "agilitySpeedScore": p["derived"]["agilitySpeedScore"],
                "shootingDrillScore": p["derived"]["shootingDrillScore"],
                "rankReference": p["ranksWithinPool"]["referenceScore"],
                "rankPhysical": p["ranksWithinPool"]["physicalToolsScore"],
                "rankExplosiveness": p["ranksWithinPool"]["explosivenessScore"],
                "rankAgility": p["ranksWithinPool"]["agilitySpeedScore"],
                "rankShooting": p["ranksWithinPool"]["shootingDrillScore"],
                "notes": "; ".join(p["notes"]),
            })


def md_table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        lines.append("| " + " | ".join(("" if value is None else str(value)).replace("|", "/") for value in row) + " |")
    return "\n".join(lines)


def top_table(payload, key, title, metric_label, n=10):
    rows = []
    for item in payload["highlightLists"][key][:n]:
        rows.append([item["poolOrdinal"], item["nameZh"], item["positionZh"], item["schoolClubZh"], item["metricValue"], item["referenceScore"], ", ".join(item["tags"][:4])])
    return f"### {title}\n\n" + md_table(["序号", "球员", "位置", "学校/俱乐部", metric_label, "参考分", "标签"], rows)


def write_markdown(payload, players, coverage_counts, full_combine_count, complete_all_count, missing_by_sheet, position_counts, position_group_counts, country_counts, school_counts, class_counts, reference_tiers):
    full_rows = []
    sorted_players = sorted(players, key=lambda p: (p["ranksWithinPool"]["referenceScore"] is None, p["ranksWithinPool"]["referenceScore"] or 999, p["poolOrdinal"]))
    for p in sorted_players:
        full_rows.append([
            p["poolOrdinal"],
            p["nameZh"],
            p["baseProfile"]["positionZh"],
            p["baseProfile"]["age"],
            p["baseProfile"]["schoolClubZh"],
            p["baseProfile"]["countryRegionZh"],
            p["measurements"]["barefootHeightIn"],
            p["derived"]["wingspanMinusBarefootHeightIn"],
            p["athleticAgility"]["maxVerticalIn"],
            p["athleticAgility"]["sprintSec"],
            p["shootingDrill"]["aggregatePct"],
            p["derived"]["referenceScore"],
            p["derived"]["referenceTier"],
            ", ".join(p["derived"]["tags"][:5]),
        ])

    lines = [
        "# 124 名球员特征与参数参考",
        "",
        f"- Generated at: `{payload['generatedAt']}`",
        "- Scope: 本报告以答题卡 `球员池_勿修改` 的 124 名球员为底表，合并本地 26-27 参选人、体测、敏捷、投篮训练数据，并用 2000-2025 Combine 历史表计算可比历史分位。",
        "- Boundary: `参数参考分` 只用于筛选和复核，不等于最终选秀预测分，也不自动改动 1-30 顺位预测。",
        "",
        "## 数据覆盖",
        "",
        md_table(["项目", "数量"], [
            ["球员池底表", len(players)],
            ["参选人名单匹配", coverage_counts["participantProfile"]],
            ["人体测量匹配", coverage_counts["anthropometric"]],
            ["力量与敏捷匹配", coverage_counts["athleticAgility"]],
            ["投篮训练匹配", coverage_counts["shootingDrill"]],
            ["三张 Combine 表均有数据", full_combine_count],
            ["完整覆盖所有来源", complete_all_count],
            ["历史 Combine 可比行", payload["validation"]["historicalRows"]],
        ]),
        "",
        "## 口径说明",
        "",
        "- 身体工具分：裸足身高、臂展、站立摸高、手长等 2026 同届分位均值。",
        "- 爆发力分：原地弹跳、助跑弹跳分位均值。",
        "- 敏捷速度分：罚球区灵敏度、折返跑、3/4 场冲刺分位均值；计时项目越低越好。",
        "- 投篮训练分：综合投篮命中率、分项平均、罚球等训练分位综合。",
        "- 参数参考分：身体工具 28%、爆发力 20%、敏捷速度 20%、投篮 22%、数据完整度 10%。缺失项不推断，未覆盖模块不加分。",
        "",
        "## 分布速览",
        "",
        md_table(["维度", "分布"], [
            ["位置", ", ".join(f"{k}:{v}" for k, v in position_counts.most_common())],
            ["位置组", ", ".join(f"{k}:{v}" for k, v in position_group_counts.most_common())],
            ["国家/地区 Top", ", ".join(f"{k}:{v}" for k, v in country_counts.most_common(8))],
            ["学校/俱乐部 Top", ", ".join(f"{k}:{v}" for k, v in school_counts.most_common(8))],
            ["年级", ", ".join(f"{k}:{v}" for k, v in class_counts.most_common())],
            ["参考分层", ", ".join(f"{k}:{v}" for k, v in reference_tiers.most_common())],
        ]),
        "",
        "## 重点榜单",
        "",
        top_table(payload, "topReferenceScore", "参数参考分 Top 12", "参数参考分", 12),
        "",
        top_table(payload, "topPhysicalTools", "身体工具 Top 10", "身体工具分", 10),
        "",
        top_table(payload, "topExplosiveness", "爆发力 Top 10", "爆发力分", 10),
        "",
        top_table(payload, "topAgilitySpeed", "敏捷速度 Top 10", "敏捷速度分", 10),
        "",
        top_table(payload, "topShootingDrill", "投篮训练 Top 10", "投篮训练分", 10),
        "",
        top_table(payload, "longestWingspanDelta", "臂展差 Top 10", "臂展-裸足身高", 10),
        "",
        "## 数据质量注意事项",
        "",
        f"- 重复姓名：{', '.join(payload['validation']['duplicatePoolNames']) or '无'}。重复姓名会保留为两个答题卡源行，按姓名匹配 Combine 数据时需要人工复核。",
        f"- 球员池中缺参选人名单：{len(missing_by_sheet['participantProfile'])} 人。",
        f"- 球员池中缺人体测量：{len(missing_by_sheet['anthropometric'])} 人。",
        f"- 球员池中缺力量/敏捷：{len(missing_by_sheet['athleticAgility'])} 人。",
        f"- 球员池中缺投篮训练：{len(missing_by_sheet['shootingDrill'])} 人。",
        "- 体脂率和卧推在本届表中大量为空或 `-`，本报告不把它们作为核心分层依据。",
        "",
        "## 124 人完整参考表",
        "",
        md_table(["序号", "球员", "位置", "年龄", "学校/俱乐部", "国家/地区", "裸足身高(in)", "臂展差(in)", "助跑弹跳(in)", "3/4冲刺(s)", "综合投篮%", "参考分", "分层", "标签"], full_rows),
        "",
        "## 输出文件",
        "",
        "- `data/normalized/normalized_2026_player_feature_reference_124.json`",
        "- `data/reports/player_feature_parameter_reference_124_20260623.csv`",
        "- `data/reports/player_feature_parameter_reference_124_20260623.md`",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
