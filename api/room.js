import { getKv } from "./_lib/kv.js";
import { handleRoom } from "./_lib/room.js";

export default async function handler(req, res) {
  return handleRoom(req, res, getKv());
}
