import { getKv } from "./_lib/kv.js";
import { handleBoard } from "./_lib/board.js";

export default async function handler(req, res) {
  return handleBoard(req, res, getKv());
}
