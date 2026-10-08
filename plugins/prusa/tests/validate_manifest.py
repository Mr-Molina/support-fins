#!/usr/bin/env python3
"""Validate Prusa plugin manifest.json structure and required fields."""

import json
import sys


def validate_manifest(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    required_fields = ["id", "name", "description", "version", "author"]
    missing = [field for field in required_fields if field not in data]
    if missing:
        sys.exit(f"Error: manifest.json is missing required fields: {missing}")

    if not isinstance(data.get("id"), str) or not data["id"]:
        sys.exit("Error: manifest id must be a non-empty string")
    if not isinstance(data.get("name"), str) or not data["name"]:
        sys.exit("Error: manifest name must be a non-empty string")
    if not isinstance(data.get("version"), str) or not data["version"]:
        sys.exit("Error: manifest version must be a non-empty string")

    print(f"  ok  {path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: validate_manifest.py <path_to_manifest.json>")
    validate_manifest(sys.argv[1])
