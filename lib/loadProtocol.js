import fs from "fs/promises";
import path from "path";

export async function getProtocol(id) {
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), "data", `${id}.json`),
      "utf8"
    );
    return JSON.parse(file);
  } catch (err) {
    return null;
  }
}
