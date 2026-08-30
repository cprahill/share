#!/usr/bin/env python3
"""Fail if BUILD 92 corridor / turbo / gauntlet-crowd rules regress."""
from pathlib import Path
import re
import sys

p = Path(__file__).with_name("game.js")
t = p.read_text()
errs = []
if 'BUILD = "92"' not in t:
    errs.append("BUILD is not 92")
if "plantCrowd(0.52" in t:
    errs.append("gauntlet crowd plantCrowd(0.52) still present")
turbos = re.findall(r'addPickup\("TURBO",\s*[\d.]+,\s*(-?[\d.]+)', t)
for lat in turbos:
    if abs(float(lat)) > 10:
        errs.append("TURBO lat %s is off the dirt (HALF_W=14)" % lat)
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
print("ok turbos", turbos)
print("ok BUILD 92 dress rules")
