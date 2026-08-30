#!/usr/bin/env python3
"""Fail if BUILD 92 corridor / turbo / gauntlet-crowd rules regress."""
from pathlib import Path
import re
import sys

p = Path(__file__).with_name("game.js")
t = p.read_text()
errs = []
if 'BUILD = "93"' not in t:
    errs.append("BUILD is not 93")
if "plantCrowd(0.52" in t:
    errs.append("gauntlet crowd plantCrowd(0.52) still present")
if 'addPickup("PAD"' in t or 'addPickup("TURBO"' in t:
    errs.append("old PAD/TURBO pickups still seeded")
boosts = re.findall(r'addPickup\("BOOST",\s*[\d.]+,\s*(-?[\d.]+)', t)
for lat in boosts:
    if abs(float(lat)) > 6:
        errs.append("BOOST lat %s is off the racing line" % lat)
if "function makeBiodome" not in t:
    errs.append("geodesic biodome missing")
if "foot * 0.5" not in t:
    errs.append("sitGlb/sitMesh footprint check is not foot * 0.5")
if "hangar_roundGlass" not in t:
    errs.append("catalog dome hangar_roundGlass not dressed")
if "emissive: 0xFFEE66" not in t and "emissive: 0xFFEE66" not in t.replace(" ", ""):
    if "0xFFEE66" not in t:
        errs.append("coin emissive gold missing")
if "function nearShipFire" not in t:
    errs.append("nearShipFire missing")
if errs:
    print("FAIL")
    for e in errs:
        print(" -", e)
    sys.exit(1)
print("ok boosts", boosts)
print("ok BUILD 93 dress rules")
