# BUILD 149 — lap + place correctness
- PLACE ignores phantom board ghosts (they were stealing 1st)
- Live rivals only for ordinal
- AI lap bump aligned to finish (~0.97) not mid-wrap 0.7
- MIN_LAP_FRAC 0.50; toast MISS GATE / CUT SHORT when finish without lap credit
- LAP panel still current lap `raceLap+1 / 3`
