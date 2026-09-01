# BUILD 145

SAVE actually writes. Root cause: raid rows stored under local `raid` while SCORES/GET use `trial`; empty live GET (`[]`) overwrote local UI; finish auto-`submitHs(true)` POSTed ACE then blocked SAVE for the same name.

submitHs now maps raid→trial, writes `rdb-board-v2`, POSTs `{planet,mode,diff,name,score,coins,time}`. Empty GET does not wipe. SAVE is the write (no silent auto-save).

Frozen: handling, addCabFill, JUMPS.

Play: http://127.0.0.1:8766/raid.html
