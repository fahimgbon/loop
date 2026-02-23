import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(contents: string) {
  const out: Record<string, string> = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const idx = withoutExport.indexOf("=");
    if (idx <= 0) continue;

    const key = withoutExport.slice(0, idx).trim();
    if (!key) continue;

    let value = withoutExport.slice(idx + 1).trim();
    if (!value) {
      out[key] = "";
      continue;
    }

    const q = value[0];
    if ((q === `"` || q === `'`) && value.length >= 2 && value.endsWith(q)) {
      value = value.slice(1, -1);
      if (q === `"`) {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, `"`)
          .replace(/\\\\/g, "\\");
      }
    }

    out[key] = value;
  }
  return out;
}

function loadFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  const parsed = parseEnvFile(contents);
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null) process.env[key] = value;
  }
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, "..");

// Prefer local overrides, then project defaults.
loadFile(path.join(root, ".env.local"));
loadFile(path.join(root, ".env"));
loadFile(path.join(root, ".env.example"));
