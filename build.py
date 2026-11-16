#!/usr/bin/env python3
"""Stitches src/ into the single-file game at index.html."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / "src"
js = "\n".join((src / f).read_text() for f in ["01-data.js", "02-sim.js", "03-audio.js", "04-scene.js", "05-ui.js"])
out = f"""<title>Boxwood Tactics</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Alegreya+Sans:wght@400;500;700;800&display=swap">
<style>
{(src / "style.css").read_text()}</style>

{(src / "body.html").read_text()}
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(() => {{
'use strict';
{js}
}})();
</script>
"""
(root / "index.html").write_text(out)
print(f"index.html: {len(out) / 1024:.1f} KB")
