#!/usr/bin/env python3
"""
POE Watcher - Path of Building Bridge

This sidecar process handles Path of Building integration:
- Converting character snapshots to PoB build codes
- Calculating DPS, defenses, and resistances
- Exporting to pobb.in for sharing
"""

import json
import sys
import base64
import zlib
from typing import Optional, Dict, Any, List

try:
    from pobapi import PathOfBuildingAPI
    POB_AVAILABLE = True
except ImportError:
    POB_AVAILABLE = False
    print("Warning: pobapi not installed. PoB features disabled.", file=sys.stderr)


def encode_pob_code(build_data: Dict[str, Any]) -> str:
    """Encode build data into a PoB import code."""
    xml_content = generate_pob_xml(build_data)
    compressed = zlib.compress(xml_content.encode('utf-8'), 9)
    encoded = base64.urlsafe_b64encode(compressed).decode('ascii')
    return encoded


def decode_pob_code(code: str) -> Dict[str, Any]:
    """Decode a PoB import code back to build data."""
    try:
        decoded = base64.urlsafe_b64decode(code)
        decompressed = zlib.decompress(decoded)
        xml_content = decompressed.decode('utf-8')
        return parse_pob_xml(xml_content)
    except Exception as e:
        return {"error": str(e)}


def generate_pob_xml(build_data: Dict[str, Any]) -> str:
    """Generate PoB-compatible XML from build data."""
    items = build_data.get("items", [])
    passives = build_data.get("passives", [])
    skills = build_data.get("skills", [])
    character = build_data.get("character", {})

    # Generate items section
    items_xml = []
    for i, item in enumerate(items):
        item_text = format_item_for_pob(item)
        items_xml.append(f'<Item id="{i+1}">\n{item_text}\n</Item>')

    # Generate skills section
    skills_xml = []
    for skill in skills:
        gem_name = skill.get("name", "Unknown")
        level = skill.get("level", 1)
        quality = skill.get("quality", 0)
        skills_xml.append(f'<Gem nameSpec="{gem_name}" level="{level}" quality="{quality}"/>')

    # Generate tree section
    tree_hashes = ",".join(str(h) for h in passives)

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
    <Build level="{character.get('level', 1)}" className="{character.get('class', 'Scion')}" ascendClassName="{character.get('ascendancy', 'None')}">
    </Build>
    <Items>
        {''.join(items_xml)}
    </Items>
    <Skills>
        <SkillSet>
            {''.join(skills_xml)}
        </SkillSet>
    </Skills>
    <Tree activeSpec="1">
        <Spec treeVersion="3_24" nodes="{tree_hashes}">
        </Spec>
    </Tree>
</PathOfBuilding>'''

    return xml


def parse_pob_xml(xml_content: str) -> Dict[str, Any]:
    """Parse PoB XML into structured data."""
    # Basic XML parsing - in production, use proper XML parser
    return {
        "raw_xml": xml_content,
        "parsed": False  # Placeholder for actual parsing
    }


def format_item_for_pob(item: Dict[str, Any]) -> str:
    """Format a POE item for PoB import."""
    lines = []

    # Rarity
    frame_type = item.get("frameType", 0)
    rarities = ["Normal", "Magic", "Rare", "Unique", "Gem"]
    rarity = rarities[min(frame_type, len(rarities) - 1)]
    lines.append(f"Rarity: {rarity}")

    # Name and type
    if item.get("name"):
        lines.append(item["name"])
    lines.append(item.get("typeLine", "Unknown Item"))

    # Item level
    if item.get("ilvl"):
        lines.append(f"Item Level: {item['ilvl']}")

    # Sockets
    if item.get("sockets"):
        socket_str = format_sockets(item["sockets"])
        lines.append(f"Sockets: {socket_str}")

    # Implicit mods
    for mod in item.get("implicitMods", []):
        lines.append(mod)

    # Separator between implicit and explicit
    if item.get("implicitMods") and item.get("explicitMods"):
        lines.append("--------")

    # Explicit mods
    for mod in item.get("explicitMods", []):
        lines.append(mod)

    return "\n".join(lines)


def format_sockets(sockets: List[Dict[str, Any]]) -> str:
    """Format socket data for PoB."""
    if not sockets:
        return ""

    groups: Dict[int, List[str]] = {}
    for socket in sockets:
        group = socket.get("group", 0)
        attr = socket.get("attr", "S")

        # Convert attribute to color
        color_map = {"S": "R", "D": "G", "I": "B", "G": "W", "A": "A", "DV": "W"}
        color = color_map.get(attr, "W")

        if group not in groups:
            groups[group] = []
        groups[group].append(color)

    # Join groups with - and sockets within groups with spaces
    group_strs = ["-".join(sockets) for _, sockets in sorted(groups.items())]
    return " ".join(group_strs)


def calculate_stats(build_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate character stats from build data."""
    # This would use pobapi for actual calculations
    # For now, return placeholder values
    return {
        "life": 0,
        "energy_shield": 0,
        "mana": 0,
        "fire_res": 0,
        "cold_res": 0,
        "lightning_res": 0,
        "chaos_res": 0,
        "dps": 0,
        "attack_speed": 0,
        "crit_chance": 0,
    }


def handle_command(command: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle a command from the main application."""
    if command == "encode":
        try:
            code = encode_pob_code(data)
            return {"success": True, "code": code}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif command == "decode":
        try:
            result = decode_pob_code(data.get("code", ""))
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif command == "stats":
        try:
            stats = calculate_stats(data)
            return {"success": True, "stats": stats}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif command == "ping":
        return {"success": True, "pob_available": POB_AVAILABLE}

    else:
        return {"success": False, "error": f"Unknown command: {command}"}


def main():
    """Main entry point - reads JSON commands from stdin, writes responses to stdout."""
    print(json.dumps({"ready": True, "pob_available": POB_AVAILABLE}), flush=True)

    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            command = request.get("command", "")
            data = request.get("data", {})

            response = handle_command(command, data)
            print(json.dumps(response), flush=True)

        except json.JSONDecodeError as e:
            print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}), flush=True)
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
