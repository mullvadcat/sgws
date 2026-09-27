#!/usr/bin/env python3
"""Check that a font's Unicode cmap covers every glyph in a UTF-8 text file."""

import argparse
import sys
from pathlib import Path

from fontTools.ttLib import TTFont


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--font",
        required=True,
        action="append",
        type=Path,
        help="TTF or WOFF2 font file; repeat to check a fallback stack",
    )
    parser.add_argument("--text", required=True, type=Path, help="UTF-8 file containing required text")
    args = parser.parse_args()

    text = args.text.read_text(encoding="utf-8")
    requested = {ord(char) for char in text if not char.isspace()}
    if not requested:
        parser.error("text file is empty or contains only whitespace")

    available: set[int] = set()
    for font_path in args.font:
        with TTFont(font_path) as font:
            available.update(font.getBestCmap() or {})
    missing = sorted(requested - available)
    if missing:
        print(f"Missing {len(missing)} unique code point(s):")
        for codepoint in missing:
            char = chr(codepoint)
            print(f"  U+{codepoint:04X} {char!r}")
        return 1

    print(f"OK: {len(requested)} unique non-whitespace code point(s) covered.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, UnicodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2)
