import fs from "fs/promises";
import path from "path";

export async function getProtocol(id) {
  if (!id) return null;

  const dir = path.join(process.cwd(), "data");
  const target = `${String(id).trim().toLowerCase()}.json`;

  try {
    const files = await fs.readdir(dir);
    const match = files.find((file) => file.toLowerCase() === target);
    if (!match) return null;
    const file = await fs.readFile(path.join(dir, match), "utf8");
    return JSON.parse(file);
  } catch {
    return null;
  }
}
