#!/usr/bin/env node
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const own = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));
const tty = process.stdout.isTTY;
const paint = (code) => (text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const [bold, dim, red] = [paint(1), paint(2), paint(31)];

const fail = (message) => {
  console.error(`${red("✕")} ${message}`);
  process.exit(1);
};

let target = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
if (!target) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  target =
    (await rl.question(`${bold("Project name")} ${dim("(my-boring-app)")} `)).trim() || "my-boring-app";
  rl.close();
}

const dir = resolve(process.cwd(), target);
const name = basename(dir)
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/^[._-]+/, "");
if (!name) fail(`"${target}" is not a usable project name`);
if (existsSync(dir) && readdirSync(dir).length) fail(`${target} exists and is not empty`);

// The template is a complete app. Only the name and the @boring-dev/* versions are filled in,
// so what you get is exactly what ships in this package.
cpSync(join(here, "../template"), dir, { recursive: true });
renameSync(join(dir, "_gitignore"), join(dir, ".gitignore"));

const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
manifest.name = name;
for (const deps of [manifest.dependencies, manifest.devDependencies])
  for (const dep of Object.keys(deps)) if (dep.startsWith("@boring-dev/")) deps[dep] = `^${own.version}`;
writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const readme = readFileSync(join(dir, "README.md"), "utf8");
writeFileSync(join(dir, "README.md"), readme.replace("# My Boring App", `# ${name}`));

const agent = process.env.npm_config_user_agent ?? "";
const pm = agent.startsWith("yarn")
  ? "yarn"
  : agent.startsWith("bun")
    ? "bun"
    : agent.startsWith("npm")
      ? "npm"
      : "pnpm";
const run = (script) => (pm === "npm" ? `npm run ${script}` : `${pm} ${script}`);

console.log(`\n🥱 Created ${bold(name)} in ${dim(dir)}\n`);
console.log(`  cd ${target}`);
console.log(`  ${pm} install`);
console.log(`  ${run("dev")}\n`);
console.log(dim(`Then ${run("explain")} shows every URL, and ${run("check")} keeps the shape honest.`));
