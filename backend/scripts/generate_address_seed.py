from __future__ import annotations

import argparse
import re
import unicodedata
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as ET


XML_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

STATEMENT_MARKER = "-- @@statement@@"
CHUNK_SIZE = 500


def column_ref_to_index(reference: str) -> int:
    letters = "".join(char for char in reference if char.isalpha())
    value = 0
    for char in letters:
        value = value * 26 + (ord(char.upper()) - 64)
    return value - 1


def read_shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []

    root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
    values: list[str] = []

    for item in root.findall("main:si", XML_NS):
        text = "".join(node.text or "" for node in item.findall(".//main:t", XML_NS))
        values.append(text)

    return values


def read_sheet_paths(workbook: zipfile.ZipFile) -> dict[str, str]:
    workbook_root = ET.fromstring(workbook.read("xl/workbook.xml"))
    rels_root = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in rels_root.findall("pkgrel:Relationship", XML_NS)
    }

    output: dict[str, str] = {}
    sheets = workbook_root.find("main:sheets", XML_NS)
    if sheets is None:
        return output

    for sheet in sheets.findall("main:sheet", XML_NS):
        relation_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        output[sheet.attrib["name"]] = f"xl/{rel_map[relation_id]}"

    return output


def read_sheet_rows(workbook: zipfile.ZipFile, sheet_path: str, shared_strings: list[str]) -> list[list[str]]:
    root = ET.fromstring(workbook.read(sheet_path))
    sheet_data = root.find("main:sheetData", XML_NS)
    if sheet_data is None:
        return []

    rows: list[list[str]] = []

    for row in sheet_data.findall("main:row", XML_NS):
        values: list[str] = []
        for cell in row.findall("main:c", XML_NS):
            index = column_ref_to_index(cell.attrib["r"])
            while len(values) <= index:
                values.append("")

            cell_type = cell.attrib.get("t")
            if cell_type == "inlineStr":
                value = "".join(node.text or "" for node in cell.findall(".//main:t", XML_NS))
            else:
                raw_node = cell.find("main:v", XML_NS)
                raw_value = "" if raw_node is None or raw_node.text is None else raw_node.text
                value = shared_strings[int(raw_value)] if cell_type == "s" and raw_value else raw_value

            values[index] = str(value).strip()

        rows.append(values)

    return rows


def normalize_name(value: str) -> str:
    collapsed = " ".join(value.strip().split())
    without_accents = "".join(
        char for char in unicodedata.normalize("NFD", collapsed) if unicodedata.category(char) != "Mn"
    )
    without_special_d = without_accents.replace("đ", "d").replace("Đ", "D")
    normalized = re.sub(r"[^a-zA-Z0-9]+", " ", without_special_d).strip().lower()
    return re.sub(r"\s+", " ", normalized)


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def chunked(items: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


@dataclass
class StateSeed:
    code: str
    name: str
    normalized_name: str


@dataclass
class CitySeed:
    state_code: str
    code: str
    name: str
    normalized_name: str
    districts: list["DistrictSeed"] = field(default_factory=list)


@dataclass
class DistrictSeed:
    state_code: str
    city_code: str
    code: str
    name: str
    normalized_name: str


def build_seed_data(source_path: Path) -> tuple[list[StateSeed], list[CitySeed], list[DistrictSeed]]:
    with zipfile.ZipFile(source_path) as workbook:
        shared_strings = read_shared_strings(workbook)
        sheet_paths = read_sheet_paths(workbook)

        required_sheets = {"State", "City", "District"}
        missing_sheets = required_sheets.difference(sheet_paths)
        if missing_sheets:
            joined = ", ".join(sorted(missing_sheets))
            raise ValueError(f"Workbook is missing required sheet(s): {joined}")

        state_rows = read_sheet_rows(workbook, sheet_paths["State"], shared_strings)
        city_rows = read_sheet_rows(workbook, sheet_paths["City"], shared_strings)
        district_rows = read_sheet_rows(workbook, sheet_paths["District"], shared_strings)

    states: list[StateSeed] = []
    state_by_name: dict[str, StateSeed] = {}

    for index, row in enumerate(state_rows[1:], start=1):
        name = row[0].strip() if row else ""
        if not name:
            continue

        state = StateSeed(
            code=f"ST{index:03d}",
            name=name,
            normalized_name=normalize_name(name),
        )
        if state.name in state_by_name:
            raise ValueError(f'Duplicate state name detected: "{state.name}"')

        states.append(state)
        state_by_name[state.name] = state

    cities: list[CitySeed] = []
    city_occurrences_by_name: dict[str, list[CitySeed]] = defaultdict(list)
    city_sequence_by_state: dict[str, int] = defaultdict(int)
    city_normalized_names_by_state: dict[str, set[str]] = defaultdict(set)

    for row in city_rows[1:]:
        if len(row) < 2:
            continue

        state_name = row[0].strip()
        city_name = row[1].strip()
        if not state_name or not city_name:
            continue

        state = state_by_name.get(state_name)
        if state is None:
            raise ValueError(f'City row references unknown state "{state_name}"')

        normalized_city_name = normalize_name(city_name)
        if normalized_city_name in city_normalized_names_by_state[state.code]:
            continue

        city_normalized_names_by_state[state.code].add(normalized_city_name)
        city_sequence_by_state[state.code] += 1
        city = CitySeed(
            state_code=state.code,
            code=f"CT{city_sequence_by_state[state.code]:03d}",
            name=city_name,
            normalized_name=normalized_city_name,
        )
        cities.append(city)
        city_occurrences_by_name[city.name].append(city)

    district_groups: list[tuple[str, list[str]]] = []
    current_parent = ""
    current_items: list[str] = []

    for row in district_rows[1:]:
        if len(row) < 2:
            continue

        parent_city_name = row[0].strip()
        district_name = row[1].strip()
        if not parent_city_name or not district_name:
            continue

        if parent_city_name != current_parent:
            if current_parent:
                district_groups.append((current_parent, current_items))
            current_parent = parent_city_name
            current_items = [district_name]
        else:
            current_items.append(district_name)

    if current_parent:
        district_groups.append((current_parent, current_items))

    city_group_usage: dict[str, int] = defaultdict(int)
    districts: list[DistrictSeed] = []

    for parent_city_name, district_names in district_groups:
        candidate_cities = city_occurrences_by_name.get(parent_city_name)
        if not candidate_cities:
            raise ValueError(f'District row references unknown city "{parent_city_name}"')

        occurrence_index = city_group_usage[parent_city_name]
        if occurrence_index >= len(candidate_cities):
            raise ValueError(
                f'District groups exceed available city parents for "{parent_city_name}" '
                f"({occurrence_index + 1} groups, {len(candidate_cities)} city rows)"
            )

        city = candidate_cities[occurrence_index]
        city_group_usage[parent_city_name] += 1

        seen_district_normalized_names: set[str] = set()
        district_sequence = 0

        for district_name in district_names:
            normalized_district_name = normalize_name(district_name)
            if normalized_district_name in seen_district_normalized_names:
                continue

            seen_district_normalized_names.add(normalized_district_name)
            district_sequence += 1
            district = DistrictSeed(
                state_code=city.state_code,
                city_code=city.code,
                code=f"DT{district_sequence:03d}",
                name=district_name,
                normalized_name=normalized_district_name,
            )
            city.districts.append(district)
            districts.append(district)

    return states, cities, districts


def build_insert_statements(states: list[StateSeed], cities: list[CitySeed], districts: list[DistrictSeed]) -> str:
    statements: list[str] = []

    state_rows = [
        f"({sql_string(state.code)}, {sql_string(state.name)}, {sql_string(state.normalized_name)}, TRUE)"
        for state in states
    ]
    for rows in chunked(state_rows, CHUNK_SIZE):
        statements.append(
            "\n".join(
                [
                    'INSERT INTO "State" ("code", "name", "normalized_name", "is_active")',
                    "VALUES",
                    ",\n".join(rows),
                    'ON CONFLICT ("code") DO NOTHING;',
                ]
            )
        )

    city_rows = [
        (
            f"({sql_string(city.state_code)}, {sql_string(city.code)}, {sql_string(city.name)}, "
            f"{sql_string(city.normalized_name)}, TRUE)"
        )
        for city in cities
    ]
    for rows in chunked(city_rows, CHUNK_SIZE):
        statements.append(
            "\n".join(
                [
                    'INSERT INTO "City" ("state_id", "code", "name", "normalized_name", "is_active")',
                    'SELECT s.id, v.code, v.name, v.normalized_name, v.is_active',
                    "FROM (VALUES",
                    ",\n".join(rows),
                    ') AS v("state_code", "code", "name", "normalized_name", "is_active")',
                    'JOIN "State" s ON s.code = v."state_code"',
                    'ON CONFLICT ("state_id", "code") DO NOTHING;',
                ]
            )
        )

    district_rows = [
        (
            f"({sql_string(district.state_code)}, {sql_string(district.city_code)}, {sql_string(district.code)}, "
            f"{sql_string(district.name)}, {sql_string(district.normalized_name)}, TRUE)"
        )
        for district in districts
    ]
    for rows in chunked(district_rows, CHUNK_SIZE):
        statements.append(
            "\n".join(
                [
                    'INSERT INTO "District" ("city_id", "code", "name", "normalized_name", "is_active")',
                    'SELECT c.id, v.code, v.name, v.normalized_name, v.is_active',
                    "FROM (VALUES",
                    ",\n".join(rows),
                    ') AS v("state_code", "city_code", "code", "name", "normalized_name", "is_active")',
                    'JOIN "State" s ON s.code = v."state_code"',
                    'JOIN "City" c ON c.state_id = s.id AND c.code = v."city_code"',
                    'ON CONFLICT ("city_id", "code") DO NOTHING;',
                ]
            )
        )

    return (
        "-- Generated by backend/scripts/generate_address_seed.py\n"
        f"-- States: {len(states)}, Cities: {len(cities)}, Districts: {len(districts)}\n"
        f"{STATEMENT_MARKER}\n"
        + f"\n{STATEMENT_MARKER}\n".join(statements)
        + "\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate address seed SQL from an Excel workbook.")
    parser.add_argument("source", type=Path, help="Path to the Address.xlsx workbook")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "prisma" / "seeds" / "address_seed.sql",
        help="Output SQL file path",
    )
    args = parser.parse_args()

    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    states, cities, districts = build_seed_data(args.source.resolve())
    sql = build_insert_statements(states, cities, districts)
    output_path.write_text(sql, encoding="utf-8")

    print(f"Generated {output_path}")
    print(f"States: {len(states)}")
    print(f"Cities: {len(cities)}")
    print(f"Districts: {len(districts)}")


if __name__ == "__main__":
    main()
