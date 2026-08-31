# BUILD 125 — dune footprint is the mesh, not 0.55×scale

124 still let a red oval onto the dirt. Keep used `max(scale.x, scale.z) * 0.55`. The geo is already stretched (~1.35 X, noise up to ~1.15) and then yawed, so the real XZ radius is ~3× that number.

**Fix (dunes only)**
- `rad = max(scale.x * geoHalfX, scale.z * geoHalfZ)` from the deformed bounding box.
- Reject if the center **or** 8 rim samples sit inside `HALF_W+4`.
- Nudge outward only while minDist increases (loop fold). Still hitting → skip.
- Clusters start at 200 m, not 140.

Start tunnel, colony, hunt slots, JUMPS / path / sit / pad untouched vs 124.
