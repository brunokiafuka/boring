import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { init, parse } from "es-module-lexer";
import { transformSync } from "esbuild";

const posix = (path) => path.split(sep).join("/");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Where a path sits in the application shape. `file` may be a module path without extension, or a feature folder. */
function classify(file) {
  const path = file.replace(/\.tsx?$/, "");
  if (/^app\/shared(\/|$)/.test(path))
    return { shared: true, layer: path.startsWith("app/shared/ui") ? "ui" : "other" };
  const feature = path.match(/^app\/features\/([^/]+)(?:\/(.*))?$/);
  if (!feature) return { layer: "other" };
  const [, name, rest = "index"] = feature;
  const folder = rest.split("/")[0];
  const layer = ["views", "components", "layouts"].includes(folder)
    ? "ui"
    : ["actions", "policies", "jobs", "resource"].includes(folder)
      ? "business"
      : "other";
  return { feature: name, folder, layer, public: rest === "index" };
}

function readImports(code, path) {
  // Keep type-only imports out: they vanish at build time.
  const js = transformSync(code, { loader: path.endsWith("x") ? "tsx" : "ts", jsx: "automatic" }).code;
  const lineOf = (specifier) => {
    const index = code
      .split("\n")
      .findIndex((line) => line.includes(`"${specifier}"`) || line.includes(`'${specifier}'`));
    return index + 1 || 1;
  };
  return parse(js)[0]
    .filter((i) => i.n && i.n !== "react/jsx-runtime")
    .map((i) => ({ specifier: i.n, line: lineOf(i.n) }));
}

const lineAt = (code, index) => code.slice(0, index).split("\n").length;

const RULES = {
  B104: "global store contains URL-shaped state",
  B110: "deep import across a feature boundary",
  B111: "import into another feature's internal/",
  B112: "app/shared imports from a feature",
  B113: "feature dependency cycle",
  B114: "public API leaks internal/",
  B120: "business module imports UI",
  B121: "component imports a view",
  B201: "action declares no input schema",
  B202: "action declares no policy",
  B217: "UI imports server code",
  B301: "hand-rolled mutation bypasses form + action",
  B401: "feature has actions but no tests",
};

const URL_SHAPED = /\b(page|status|filter|filters|sort|query|search|tab)\b\s*[:=]\s*(signal|useSignal)\(/g;
const SERVER_SPECIFIER = /^(@boring-dev\/node|node:|pg$|postgres$|better-sqlite3$)/;

/** Bodies of `name({ ... })` calls, matched by brace depth. */
function calls(code, name) {
  const found = [];
  const pattern = new RegExp(`\\b${name}\\(\\s*\\{`, "g");
  for (let match; (match = pattern.exec(code));) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < code.length; end++) {
      if (code[end] === "{") depth++;
      else if (code[end] === "}" && --depth === 0) break;
    }
    found.push({ index: match.index, body: code.slice(match.index, end + 1) });
  }
  return found;
}
const declares = (body, key) => new RegExp(`(^|[\\s,{])${key}\\s*[:,}]`).test(body);

export async function check(root, { today = new Date() } = {}) {
  await init;
  const findings = [];
  /** feature → the features it imports, with where. */
  const edges = {};
  const passed = [];
  const files = [...walk(join(root, "app"))];

  for (const path of files) {
    const file = posix(relative(root, path));
    const code = readFileSync(path, "utf8");
    const here = classify(file);
    const add = (rule, line, advice) => findings.push({ rule, title: RULES[rule], file, line, advice });

    for (const { specifier, line } of readImports(code, path)) {
      const local = specifier.startsWith(".") || specifier.startsWith("@/");
      const target = specifier.startsWith("@/")
        ? `app/${specifier.slice(2)}`
        : specifier.startsWith(".")
          ? posix(relative(root, resolve(dirname(path), specifier)))
          : specifier;
      const there = local ? classify(target) : { layer: "package" };
      const crossing = there.feature && there.feature !== here.feature;

      // feature → app/shared, its own code, or another feature's public API. Nothing else.
      if (crossing) (edges[here.feature ?? "app"] ??= new Map()).set(there.feature, { file, line });
      if (crossing && there.folder === "internal") {
        add(
          "B111",
          line,
          `${there.feature}/internal is private; ask ${there.feature} to expose what you need`,
        );
      } else if (crossing && !there.public) {
        add("B110", line, `import from "@/features/${there.feature}" instead`);
      }
      if (here.shared && there.feature)
        add(
          "B112",
          line,
          "shared code cannot depend on a feature; move it into the feature or invert the dependency",
        );
      if (here.public && there.feature === here.feature && there.folder === "internal") {
        add(
          "B114",
          line,
          "internal/ is private by definition; move the module out of internal/ before exposing it",
        );
      }

      if (here.layer === "business" && (there.layer === "ui" || /^react(-dom)?($|\/)/.test(specifier))) {
        add("B120", line, "business rules must not depend on UI");
      }
      if (here.folder === "components" && there.folder === "views") {
        add("B121", line, "views compose components, never the other way round");
      }
      if (here.layer === "ui") {
        const serverPath = /^app\/(db|shared\/auth)(\/|$)/.test(target);
        // UI may hold references to actions and resources; policies and jobs stay server-side.
        const serverModule = there.layer === "business" && !["actions", "resource"].includes(there.folder);
        if (SERVER_SPECIFIER.test(specifier) || serverPath || serverModule) {
          add("B217", line, "load through a resource and read it with current()");
        }
      }
    }

    if (here.folder === "actions") {
      for (const a of calls(code, "action")) {
        if (!declares(a.body, "input")) add("B201", lineAt(code, a.index), "validate with one schema");
        if (!declares(a.body, "policy")) add("B202", lineAt(code, a.index), "authorize with a named policy");
      }
    }
    if (/(^|\/)store\.tsx?$/.test(file) || /\/stores?\//.test(file)) {
      for (const match of code.matchAll(URL_SHAPED)) {
        add("B104", lineAt(code, match.index), `move \`${match[1]}\` to search params`);
      }
    }
    if (here.layer === "ui" || /\/use-[^/]+\.tsx?$/.test(file)) {
      for (const match of code.matchAll(/fetch\([^)]*method:\s*["'`](POST|PUT|PATCH|DELETE)/gs)) {
        add("B301", lineAt(code, match.index), "use the canonical Form + action path");
      }
    }
  }

  for (const cycle of cycles(edges)) {
    const { file, line } = edges[cycle[0]].get(cycle[1]);
    findings.push({
      rule: "B113",
      title: RULES.B113,
      file,
      line,
      advice: `${[...cycle, cycle[0]].join(" → ")}; extract what both need, or merge the features`,
    });
  }

  const featuresDir = join(root, "app/features");
  for (const feature of existsSync(featuresDir) ? readdirSync(featuresDir) : []) {
    const has = (folder) => walk(join(featuresDir, feature, folder)).length > 0;
    if (
      has("actions") &&
      !walk(join(featuresDir, feature, "tests")).some((path) => /\.test\.tsx?$/.test(path))
    ) {
      const file = posix(relative(root, walk(join(featuresDir, feature, "actions"))[0]));
      findings.push({
        rule: "B401",
        title: RULES.B401,
        file,
        line: 1,
        advice: `add app/features/${feature}/tests/*.test.ts and drive it with @boring-dev/test`,
      });
    }
  }

  // Suppressions need a reason and an expiry:  // boring-ignore B217 until 2026-12-01: reason
  const active = findings.filter((finding) => {
    const lines = readFileSync(join(root, finding.file), "utf8").split("\n");
    const note = [lines[finding.line - 2], lines[finding.line - 1]].join("\n");
    const match = note?.match(
      new RegExp(`boring-ignore ${finding.rule} until (\\d{4}-\\d{2}-\\d{2}):\\s*\\S`),
    );
    return !(match && new Date(match[1]) >= today);
  });

  const broken = new Set(active.map((f) => f.rule));
  const has = (...rules) => rules.some((rule) => broken.has(rule));
  if (!has("B110", "B111", "B114")) passed.push("features only meet through their public APIs");
  if (!has("B113")) passed.push("no feature dependency cycles");
  if (!has("B112")) passed.push("app/shared depends on no feature");
  if (!has("B120", "B121", "B217")) passed.push("UI, business rules and server code point the right way");
  if (!has("B201", "B202")) passed.push("actions declare input schemas and policies");
  if (!has("B104", "B301")) passed.push("no parallel state or mutation systems");
  if (!has("B401")) passed.push("features with actions have tests");

  return {
    files: files.length,
    passed,
    findings: active,
    suppressed: findings.length - active.length,
    score: Math.max(0, 100 - active.length * 4),
  };
}

/** Each cycle once, starting from its alphabetically first feature. */
function cycles(edges) {
  const found = new Map();
  const visit = (node, trail) => {
    if (trail.includes(node)) {
      const loop = trail.slice(trail.indexOf(node));
      const start = loop.indexOf(loop.toSorted()[0]);
      const canonical = [...loop.slice(start), ...loop.slice(0, start)];
      return void found.set(canonical.join(">"), canonical);
    }
    for (const next of edges[node]?.keys() ?? []) visit(next, [...trail, node]);
  };
  for (const feature of Object.keys(edges)) visit(feature, []);
  return [...found.values()];
}

/** What each feature exposes, read from its index.ts without running it. */
export async function publicApis(root) {
  await init;
  const dir = join(root, "app/features");
  return Object.fromEntries(
    (existsSync(dir) ? readdirSync(dir) : []).map((feature) => {
      const file = join(dir, feature, "index.ts");
      if (!existsSync(file)) return [feature, null];
      const js = transformSync(readFileSync(file, "utf8"), { loader: "ts" }).code;
      return [feature, parse(js)[1].map((e) => e.n)];
    }),
  );
}

/** Static facts about an action file that the runtime graph cannot see. */
export function effectsOf(code) {
  return {
    invalidates: [...code.matchAll(/(\w+)\.key\(/g)].map((m) => m[1]),
    enqueues: [...code.matchAll(/(\w+)\.enqueue\(/g)].map((m) => m[1]),
    mutates: [
      ...new Set([...code.matchAll(/(\w+)\.(update|create|delete|remove|insert)\(/g)].map((m) => m[1])),
    ],
  };
}
