import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function isReadOnlyRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getWritableLogDirectory() {
  if (isReadOnlyRuntime()) {
    return path.join(os.tmpdir(), "parking-sign-logs");
  }

  return path.join(process.cwd(), "logs");
}

export async function appendJsonLine(filename, payload) {
  const directory = getWritableLogDirectory();
  const target = path.join(directory, filename);

  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(target, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    if (!isReadOnlyRuntime()) {
      throw error;
    }
  }
}
