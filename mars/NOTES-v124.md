# BUILD 124 — Explorer Easy, no stacked pair

Easy plants 4 hunt items (cow, chicken, sheep, raptor). They used consecutive sites `0..3`. The cow’s start site is often blocked (rocket / launch); the GLB retry then called `huntSiteAt(i + 3)` and landed on the raptor’s site. Occupancy was never checked.

**Fix**
- Spread slots around the loop (`i * sites / n`), so Easy is 0 / 3 / 7 / 10, not 0–3.
- `huntBlocked` rejects spots within 32 m of another hunt item.
- Retry walks unused sites; does not blindly use `i + 3`.

Dunes, start tunnel, JUMPS / path / sit / pad untouched vs 123.
