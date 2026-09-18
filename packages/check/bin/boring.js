#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { check, effectsOf, publicApis } from "../src/index.js";

const [command, target] = process.argv.slice(2);
const root = process.cwd();
const tty = process.stdout.isTTY;
const paint = (code) => (text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const [green, red, dim, bold] = [paint(32), paint(31), paint(2), paint(1)];

/** The application graph, from the real route tree. */
async function loadGraph() {
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    logLevel: "silent",
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const { manifest } = await server.ssrLoadModule("virtual:boring/server");
    const { describe } = await server.ssrLoadModule("@boring-dev/node/handler");
    return describe(manifest);
  } finally {
    await server.close();
  }
}

async function runCheck() {
  const report = await check(root);
  const graph = await loadGraph();
  if (graph.problems.length === 0)
    console.log(
      `${green("✓")} route tree is valid: ${graph.routes.length} routes, no duplicates or conflicts`,
    );
  for (const problem of graph.problems) {
    console.log(`${red("✕")} ${bold("B130")} route tree: ${problem}`);
    report.findings.push({ rule: "B130" });
    report.score = Math.max(0, report.score - 4);
  }
  for (const line of report.passed) console.log(`${green("✓")} ${line}`);
  for (const f of report.findings) {
    if (!f.file) continue;
    console.log(`${red("!")} ${bold(f.rule)} ${f.title}`);
    console.log(`  ${dim(`${f.file}:${f.line}`)} — ${f.advice}`);
  }
  const blockers = report.findings.length;
  console.log(`\n${bold(`Boring score: ${report.score}/100`)}`);
  console.log(dim(`${report.files} files · ${blockers} findings · ${report.suppressed} suppressed`));
  process.exitCode = blockers ? 1 : 0;
}

/** No file: what features exist, what they expose, what URLs exist, how layouts compose. */
async function explainApp() {
  const graph = await loadGraph();
  console.log(bold("Features"));
  for (const [feature, exposed] of Object.entries(await publicApis(root))) {
    console.log(
      `  ${bold(feature)} exposes ${!exposed ? red("nothing: no index.ts") : exposed.join(", ") || dim("nothing")}`,
    );
  }
  console.log(`\n${bold("Routes")}`);
  const width = Math.max(
    ...graph.routes.map((r) => r.path.length),
    ...graph.redirects.map((r) => r.from.length),
  );
  for (const r of graph.routes.toSorted((a, b) => a.path.localeCompare(b.path))) {
    const shape = [...r.layouts, r.view].join(" › ");
    const notes = [
      r.owner,
      r.policies.join(" + "),
      ...(r.actions.length ? [`${r.actions.length} action`] : []),
    ];
    console.log(`  ${r.path.padEnd(width)}  ${shape}  ${dim(notes.join(" · "))}`);
  }
  for (const r of graph.redirects) console.log(`  ${r.from.padEnd(width)}  ${dim("→")} ${r.to}`);
  for (const problem of graph.problems) console.log(`  ${red("✕")} ${problem}`);
}

async function runExplain() {
  if (!target) return explainApp();
  if (!existsSync(resolve(root, target))) {
    console.error(`boring explain: no such file ${target}`);
    return void (process.exitCode = 1);
  }
  const graph = await loadGraph();
  const stem = relative(resolve(root, "app/features"), resolve(root, target)).replace(/\.tsx?$/, "");
  const lines = [];

  for (const action of graph.actions.filter((a) => a.id?.startsWith(`${stem}#`))) {
    const effects = effectsOf(readFileSync(resolve(root, target), "utf8"));
    console.log(`· ${bold(action.id.split("#")[1])} is a canonical action`);
    for (const name of effects.mutates) lines.push(`mutates ${bold(name)}`);
    lines.push(action.policy ? `requires ${bold(action.policy)}` : red("declares no policy"));
    lines.push(action.validates ? "validates input with a schema" : red("declares no input schema"));
    for (const r of graph.routes.filter((used) => used.actions.includes(action.id)))
      lines.push(`used by ${bold(r.path)}`);
    for (const name of effects.invalidates) lines.push(`invalidates ${bold(`${name}/:id`)}`);
    for (const name of effects.enqueues) lines.push(`enqueues ${bold(name)} after commit`);
  }
  if (!lines.length)
    lines.push(
      dim("not an action file. Run `boring explain` with no file for the features and the route tree."),
    );
  lines.forEach((line, i) => console.log(`${i === lines.length - 1 ? "└" : "├"} ${line}`));
}

if (command === "check") await runCheck();
else if (command === "explain") await runExplain();
else console.log("usage: boring <check | explain [file]>");
