#!/usr/bin/env python3
"""Stitches src/ into the single-file game at index.html."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / "src"
js = "\n".join((src / f).read_text() for f in ["01-data.js", "02-sim.js", "03-audio.js", "04-render.js", "05-ui.js"])
out = f"""<title>Last Call Tactics</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Limelight&family=Outfit:wght@400;500;600;700;800&family=Yellowtail&display=swap">
<style>
{(src / "style.css").read_text()}</style>

{(src / "body.html").read_text()}
<script>
(() => {{
'use strict';
{js}
}})();
</script>
"""
(root / "index.html").write_text(out)
print(f"index.html: {len(out) / 1024:.1f} KB")
