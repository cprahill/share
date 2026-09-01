import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowOrigin } from "../api/_lib/cors.js";
import {
  boardKey,
  handleBoard,
  insertRow,
  parseDiff,
  parseScoreRow,
  sanitizeName,
  sortBoard
} from "../api/_lib/board.js";
import { handleRoom, roomKey, sanitizeCode } from "../api/_lib/room.js";

function memoryKv() {
  const store = new Map();
  return {
    async get(key) {
      const e = store.get(key);
      if (!e) return null;
      if (e.exp && Date.now() > e.exp) {
        store.delete(key);
        return null;
      }
      return e.val;
    },
    async set(key, val, ex) {
      store.set(key, { val, exp: ex ? Date.now() + ex * 1000 : 0 });
      return true;
    },
    async setNx(key, val, ex) {
      if ((await this.get(key)) != null) return false;
      await this.set(key, val, ex);
      return true;
    }
  };
}

function req(method, { query, body, headers, url } = {}) {
  return {
    method,
    query: query || {},
    body,
    headers: headers || {},
    url: url || "/api/board"
  };
}

function res() {
  const r = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) {
      r.headers[k] = v;
      return r;
    },
    status(c) {
      r.statusCode = c;
      return r;
    },
    json(b) {
      r.body = b;
      return r;
    },
    end(b) {
      if (b) r.body = b;
      return r;
    }
  };
  return r;
}

async function call(handler, kv, method, opts) {
  const r = res();
  await handler(req(method, opts), r, kv);
  return r;
}

describe("cors", () => {
  it("allows Pages, Mini 8766, and any localhost/127 port", () => {
    assert.equal(allowOrigin("https://cprahill.github.io"), "https://cprahill.github.io");
    assert.equal(allowOrigin("http://127.0.0.1:8766"), "http://127.0.0.1:8766");
    assert.equal(allowOrigin("http://localhost:8766"), "http://localhost:8766");
    assert.equal(allowOrigin("http://127.0.0.1:9999"), "http://127.0.0.1:9999");
    assert.equal(allowOrigin("http://localhost:1234"), "http://localhost:1234");
    assert.equal(allowOrigin("https://evil.example"), "");
    assert.equal(allowOrigin("https://localhost:8766"), "");
  });
});

describe("board ranking", () => {
  it("builds the kv key and sanitizes names", () => {
    assert.equal(boardKey("mars", "raid", "medium"), "baja:v1:mars/raid/medium");
    assert.equal(sanitizeName("ace-1"), "ACE1");
    assert.equal(sanitizeName("toolongname"), "TOOL");
    assert.equal(parseDiff("MED"), "medium");
    assert.equal(parseDiff("xhard"), "extra");
  });

  it("sorts trial by time and others by score, max 3", () => {
    const trial = sortBoard("trial", [
      { name: "A", time: 30 },
      { name: "B", time: 10 },
      { name: "C", time: 20 },
      { name: "D", time: 5 }
    ]);
    assert.deepEqual(trial.map((r) => r.name), ["D", "B", "C"]);
    const raid = sortBoard("raid", [
      { name: "A", score: 1 },
      { name: "B", score: 9 },
      { name: "C", score: 3 }
    ]);
    assert.deepEqual(raid.map((r) => r.name), ["B", "C", "A"]);
  });

  it("inserts only if it beats 3rd, or replaces same name when better", () => {
    let rows = [
      { name: "AAA1", score: 100, coins: 0, time: 1, diff: "MED", place: "1st", cup: "GOLD", mode: "raid", planet: "mars" },
      { name: "BBB2", score: 80, coins: 0, time: 1, diff: "MED", place: "1st", cup: "GOLD", mode: "raid", planet: "mars" },
      { name: "CCC3", score: 60, coins: 0, time: 1, diff: "MED", place: "1st", cup: "GOLD", mode: "raid", planet: "mars" }
    ];
    let next = insertRow("raid", rows, { name: "DDD4", score: 50, coins: 0, time: 1, diff: "MED", place: "", cup: "", mode: "raid", planet: "mars" });
    assert.equal(next.inserted, false);
    assert.equal(next.rows.length, 3);

    next = insertRow("raid", rows, { name: "DDD4", score: 70, coins: 0, time: 1, diff: "MED", place: "", cup: "", mode: "raid", planet: "mars" });
    assert.equal(next.inserted, true);
    assert.equal(next.rows[2].name, "DDD4");

    next = insertRow("raid", next.rows, { name: "AAA1", score: 40, coins: 0, time: 1, diff: "MED", place: "", cup: "", mode: "raid", planet: "mars" });
    assert.equal(next.inserted, false);
    assert.equal(next.rows[0].name, "AAA1");

    next = insertRow("raid", next.rows, { name: "AAA1", score: 200, coins: 0, time: 1, diff: "MED", place: "", cup: "", mode: "raid", planet: "mars" });
    assert.equal(next.inserted, true);
    assert.equal(next.rows[0].score, 200);
  });
});

describe("GET/POST /api/board", () => {
  it("returns 503 no-kv when storage is missing", async () => {
    const r = await call(handleBoard, null, "GET", { query: { planet: "mars", mode: "raid", diff: "medium" } });
    assert.equal(r.statusCode, 503);
    assert.deepEqual(r.body, { ok: false, error: "no-kv" });
  });

  it("reads and writes a lane", async () => {
    const kv = memoryKv();
    let r = await call(handleBoard, kv, "GET", { query: { planet: "mars", mode: "raid", diff: "medium" } });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.key, "baja:v1:mars/raid/medium");
    assert.deepEqual(r.body.rows, []);

    r = await call(handleBoard, kv, "POST", {
      headers: { origin: "https://cprahill.github.io" },
      body: { planet: "mars", mode: "raid", diff: "medium", name: "ACE1", score: 12, coins: 3, time: 9000, place: "1st", cup: "GOLD" }
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers["Access-Control-Allow-Origin"], "https://cprahill.github.io");
    assert.equal(r.body.rows.length, 1);
    assert.equal(r.body.rows[0].name, "ACE1");
    assert.equal(r.body.rows[0].diff, "MED");
    assert.equal(r.body.inserted, true);

    r = await call(handleBoard, kv, "POST", {
      body: { planet: "mars", mode: "trial", diff: "easy", name: "ZED9", score: 0, coins: 0, time: 111 }
    });
    assert.equal(r.body.key, "baja:v1:mars/trial/easy");
    r = await call(handleBoard, kv, "POST", {
      body: { planet: "mars", mode: "trial", diff: "easy", name: "ABE1", score: 0, coins: 0, time: 90 }
    });
    assert.equal(r.body.rows[0].name, "ABE1");
  });

  it("rejects a bad lane", async () => {
    const kv = memoryKv();
    const r = await call(handleBoard, kv, "GET", { query: { planet: "pluto", mode: "raid", diff: "medium" } });
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, "bad-lane");
  });

  it("parses a score body", () => {
    const p = parseScoreRow({ planet: "moon", mode: "hunt", diff: "XHARD", name: "ok!", score: 5, coins: 2, time: 3 });
    assert.equal(p.row.name, "OK");
    assert.equal(p.diff, "extra");
    assert.equal(p.row.diff, "XHARD");
  });
});

describe("GET/POST /api/room", () => {
  it("returns 503 no-kv without storage", async () => {
    const r = await call(handleRoom, null, "POST", { body: { action: "create" } });
    assert.equal(r.statusCode, 503);
    assert.equal(r.body.error, "no-kv");
  });

  it("creates, signals, and reads a room", async () => {
    const kv = memoryKv();
    let r = await call(handleRoom, kv, "POST", { body: { action: "create" } });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.ok, true);
    const code = r.body.code;
    assert.equal(sanitizeCode(code).length, 4);
    assert.ok(await kv.get(roomKey(code)));

    r = await call(handleRoom, kv, "POST", {
      body: { action: "offer", code, payload: { type: "offer", sdp: "v=0" } }
    });
    assert.equal(r.body.offer.sdp, "v=0");

    r = await call(handleRoom, kv, "POST", {
      body: { action: "join", code, sdp: { type: "offer", sdp: "join-sdp" } }
    });
    assert.equal(r.body.join.sdp.sdp, "join-sdp");

    r = await call(handleRoom, kv, "POST", {
      body: { action: "ice", code, payload: { candidate: "c1" } }
    });
    assert.equal(r.body.ice.length, 1);

    r = await call(handleRoom, kv, "GET", { query: { code } });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.code, code);
    assert.equal(r.body.answer, null);
  });

  it("404s a missing room", async () => {
    const kv = memoryKv();
    const r = await call(handleRoom, kv, "GET", { query: { code: "ZZZZ" } });
    assert.equal(r.statusCode, 404);
    assert.equal(r.body.error, "no-room");
  });
});
