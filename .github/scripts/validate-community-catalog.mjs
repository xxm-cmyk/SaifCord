import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

const root = process.cwd();
const catalogPath = resolve(root, "community-plugins/catalog.json");
const pluginRoot = resolve(root, "community-plugins/plugins");
const errors = [];
const fail = message => errors.push(message);
const accepted = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json"]);
const maxFiles = 64;
const maxFileBytes = 512 * 1024;
const maxTotalBytes = 4 * 1024 * 1024;

if (!existsSync(catalogPath)) {
  console.error("Missing community-plugins/catalog.json");
  process.exit(1);
}

let catalog;
try {
  catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
} catch (error) {
  console.error("Catalog JSON is invalid:", error.message);
  process.exit(1);
}

if (catalog.schemaVersion !== 1 || catalog.repository !== "xxm-cmyk/SaudiCord" || !Array.isArray(catalog.plugins)) {
  fail("Catalog must declare schemaVersion 1, repository xxm-cmyk/SaudiCord, and a plugins array.");
}

const ids = new Set();
for (const plugin of catalog.plugins ?? []) {
  const label = String(plugin?.id ?? "(unknown)");
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(plugin.id ?? "")) fail(`${label}: invalid plugin id`);
  if (ids.has(plugin.id)) fail(`${label}: duplicate plugin id`);
  ids.add(plugin.id);

  if (typeof plugin.name !== "string" || !plugin.name.trim() || plugin.name.length > 80) fail(`${label}: invalid name`);
  if (typeof plugin.description !== "string" || !plugin.description.trim() || plugin.description.length > 500) fail(`${label}: invalid description`);
  if (!Array.isArray(plugin.authors) || plugin.authors.length < 1 || plugin.authors.length > 5 || plugin.authors.some(a => typeof a !== "string" || !a.trim() || a.length > 80)) fail(`${label}: invalid authors`);
  if (typeof plugin.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(plugin.version)) fail(`${label}: invalid semver version`);
  if (typeof plugin.commit !== "string" || !/^[0-9a-f]{40}$/.test(plugin.commit)) fail(`${label}: commit must be a full lowercase Git SHA`);
  if (typeof plugin.entry !== "string" || !/^(?:[A-Za-z0-9_-]+\/)*index\.(?:ts|tsx|js|jsx)$/.test(plugin.entry)) fail(`${label}: entry must be a relative index source file`);
  if (!Array.isArray(plugin.files) || plugin.files.length < 1 || plugin.files.length > maxFiles) {
    fail(`${label}: files must contain between 1 and ${maxFiles} entries`);
    continue;
  }

  const seen = new Set();
  let total = 0;
  let hasEntry = false;
  for (const file of plugin.files) {
    const rel = file?.path;
    if (typeof rel !== "string" || rel.startsWith("/") || rel.includes("\\") || rel.split("/").some(p => !p || p === "." || p === "..")) {
      fail(`${label}: unsafe file path ${String(rel)}`);
      continue;
    }
    if (seen.has(rel)) fail(`${label}: duplicate file path ${rel}`);
    seen.add(rel);
    const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
    if (!accepted.has(ext)) fail(`${label}: unsupported extension for ${rel}`);
    if (rel === plugin.entry) hasEntry = true;
    if (typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      fail(`${label}: invalid SHA-256 for ${rel}`);
      continue;
    }

    const base = resolve(pluginRoot, plugin.id);
    const target = resolve(base, rel);
    const inside = relative(base, target);
    if (!inside || inside.startsWith(`..${sep}`) || inside === "..") {
      fail(`${label}: path escapes plugin directory: ${rel}`);
      continue;
    }
    if (!existsSync(target)) {
      fail(`${label}: missing source file ${rel}`);
      continue;
    }
    try {
      if (realpathSync(target) !== target || !statSync(target).isFile()) {
        fail(`${label}: symlink or non-file is not allowed: ${rel}`);
        continue;
      }
    } catch {
      fail(`${label}: cannot inspect ${rel}`);
      continue;
    }

    const bytes = readFileSync(target);
    total += bytes.length;
    if (bytes.length > maxFileBytes) fail(`${label}: ${rel} exceeds per-file size limit`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== file.sha256) fail(`${label}: SHA-256 mismatch for ${rel}`);

    const source = bytes.toString("utf8");
    if (source.includes("\u0000")) fail(`${label}: binary/NUL content in ${rel}`);
    if (source.split("\n").some(line => line.length > 2000)) fail(`${label}: generated/minified line in ${rel}`);
    if (/sourceMappingURL\s*=/.test(source)) fail(`${label}: source map reference in ${rel}`);
    if (/\b(?:eval|Function)\s*\(/.test(source)) fail(`${label}: dynamic code execution pattern in ${rel} (manual review required)`);
    if (/localStorage.{0,30}(?:token|auth|session)|sessionStorage.{0,30}(?:token|auth)|\bgetToken\s*\(|webpackChunkdiscord_app/i.test(source)) fail(\`${label}: credential access pattern in \${rel}\`);
    if (/\bdocument\s*\.\s*cookie\b|\bcookieStore\s*\./i.test(source)) fail(\`${label}: cookie access pattern in \${rel}\`);
    if (/window\s*\.\s*require\s*\(|require\s*\([^)]*electron|process\s*\.\s*(?:env|versions|mainModule)|\bipcRenderer\b/i.test(source)) fail(\`${label}: privileged runtime access pattern in \${rel}\`);
  }
  if (!hasEntry) fail(`${label}: entry file is not included in files`);
  if (total > maxTotalBytes) fail(`${label}: total source size exceeds limit`);
}

if (errors.length) {
  console.error("Community catalog validation failed:");
  for (const error of errors) console.error(" -", error);
  process.exit(1);
}

console.log(`Validated ${catalog.plugins.length} catalog entr${catalog.plugins.length === 1 ? "y" : "ies"}. Human review is still required.`);
