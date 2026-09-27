import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / "tools" / "check_hud_font.py"


def make_font(path: Path, characters: str) -> None:
    glyph_names = [".notdef"] + [f"g{ord(char):04X}" for char in sorted(set(characters))]
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(glyph_names)
    builder.setupCharacterMap({ord(char): f"g{ord(char):04X}" for char in sorted(set(characters))})
    builder.setupGlyf({name: TTGlyphPen(None).glyph() for name in glyph_names})
    builder.setupHorizontalMetrics({name: (600, 0) for name in glyph_names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": "Fixture", "styleName": "Regular", "uniqueFontIdentifier": "Fixture Regular", "fullName": "Fixture Regular", "psName": "Fixture-Regular"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    builder.setupMaxp()
    builder.save(path)


class CheckHudFontTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.font = self.directory / "fixture.ttf"
        self.text = self.directory / "glyphs.txt"

    def tearDown(self):
        self.temp.cleanup()

    def run_checker(self, font_characters: str, requested: str):
        make_font(self.font, font_characters)
        self.text.write_text(requested, encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(CHECKER), "--font", str(self.font), "--text", str(self.text)],
            capture_output=True,
            text=True,
            check=False,
        )

    def run_checker_with_fonts(self, font_characters: list[str], requested: str):
        fonts = []
        for index, characters in enumerate(font_characters):
            font = self.directory / f"fixture-{index}.ttf"
            make_font(font, characters)
            fonts.extend(["--font", str(font)])
        self.text.write_text(requested, encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(CHECKER), *fonts, "--text", str(self.text)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_complete_font_coverage_exits_successfully(self):
        result = self.run_checker("AB", "ABBA\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("2 unique", result.stdout)

    def test_missing_glyph_exits_nonzero_and_names_codepoint(self):
        result = self.run_checker("AB", "ABC")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("U+0043", result.stdout)

    def test_duplicate_missing_glyph_is_reported_once(self):
        result = self.run_checker("A", "CACAC")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout.count("U+0043"), 1)

    def test_empty_glyph_manifest_is_rejected(self):
        result = self.run_checker("A", " \n\t")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("empty", result.stderr.lower())

    def test_fallback_font_can_supply_missing_glyphs(self):
        result = self.run_checker_with_fonts(["A", "B"], "AB")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("2 unique", result.stdout)


if __name__ == "__main__":
    unittest.main()
