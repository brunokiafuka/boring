import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import react from "@vitejs/plugin-react";
import { init, parse } from "es-module-lexer";
import { transformWithEsbuild } from "vite";

const CLIENT = "virtual:boring/client";
const SERVER = "virtual:boring/server";

/** Inside a feature, these never reach the browser. */
const SERVER_ONLY = [
  /^app\/features\/[^/]+\/(actions|policies|jobs)\//,
  /^app\/features\/[^/]+\/resource\.ts$/,
  /^app\/shared\/auth\//,
  /^app\/db\//,
  /^boring\.config\.ts$/,
];
const TAGGED = /^app\/features\/(.+)\.tsx?$/;

const posix = (path) => path.split(sep).join("/");

const imports = (paths, prefix) =>
  paths.map((path, i) => `import * as ${prefix}${i} from "${path}";`).join("\n");
const list = (paths, prefix) => `[${paths.map((_, i) => `${prefix}${i}`).join(", ")}]`;

async function exportsOf(code, id) {
  await init;
  const js = await transformWithEsbuild(code, id, { sourcemap: false });
  return parse(js.code)[1];
}

/**
 * Vite owns the machinery. This teaches it the shape of a Boring app, and brings the
 * React adapter with Boring's JSX runtime so a plain <form> can point at an action.
 */
export const boring = () => [application(), ...react({ jsxImportSource: "@boring-dev/react" })];

function application() {
  let root = process.cwd();

  const features = () =>
    existsSync(join(root, "app/features")) ? readdirSync(join(root, "app/features")) : [];

  const featureFiles = (folder) =>
    features().flatMap((feature) => {
      const dir = join(root, "app/features", feature, folder);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => `/app/features/${feature}/${folder}/${name}`);
    });

  // The route tree is authored in app/routes.ts. Only jobs are found by convention,
  // because the queue must know them even when no route mentions them.
  function virtualModule(id) {
    if (id === CLIENT)
      return `import { start } from "@boring-dev/react/client";\nimport tree from "/app/routes.ts";\nstart(tree);`;

    const jobs = featureFiles("jobs");
    return `import { createRender } from "@boring-dev/react/server";
import config from "/boring.config.ts";
import tree from "/app/routes.ts";
${imports(jobs, "job")}
export const manifest = { tree, jobModules: ${list(jobs, "job")}, config, render: createRender(tree) };`;
  }

  return {
    name: "boring",
    enforce: "pre",

    config: (user) => ({
      // The testing convention: each feature keeps its tests in tests/. Vitest reads this.
      test: { include: ["app/**/tests/**/*.test.{ts,tsx}"], environment: "node" },
      appType: "custom",
      resolve: { dedupe: ["react", "react-dom"], alias: { "@": resolve(user.root ?? process.cwd(), "app") } },
      ssr: { noExternal: [/^@boring-dev\//] },
      optimizeDeps: {
        entries: ["app/**/*.{ts,tsx}"],
        include: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "zod",
        ],
        exclude: ["@boring-dev/react", "@boring-dev/core"],
      },
    }),

    configResolved(config) {
      root = config.root;
    },

    resolveId(id) {
      if (id === CLIENT || id === SERVER) return `\0${id}`;
    },

    load(id) {
      if (id === `\0${CLIENT}` || id === `\0${SERVER}`) return virtualModule(id.slice(1));
    },

    async transform(code, id, options) {
      const file = posix(relative(root, id.split("?")[0]));
      if (file.startsWith("..") || !/\.tsx?$/.test(file)) return;

      if (!options?.ssr) {
        if (!SERVER_ONLY.some((pattern) => pattern.test(file))) return;
        // The browser gets references, never the server code behind them.
        const isAction = /\/actions\//.test(file);
        const tag = file.match(TAGGED)?.[1];
        const lines = (await exportsOf(code, id)).map(({ n: name }) => {
          const value = isAction ? `actionRef("${tag}#${name}")` : `serverOnly("${name}")`;
          return name === "default" ? `export default ${value};` : `export const ${name} = ${value};`;
        });
        return {
          code: `import { actionRef, serverOnly } from "@boring-dev/core/stub";\n${lines.join("\n")}`,
          map: null,
        };
      }

      const tag = file.match(TAGGED)?.[1];
      if (!tag) return;
      // Name every exported primitive so the application graph can explain it.
      const tags = (await exportsOf(code, id))
        .filter((e) => e.ln)
        .map((e) => `boringInternals.tag(${e.ln}, "${tag}#${e.n}");`);
      if (!tags.length) return;
      return {
        code: `${code}\nimport { internals as boringInternals } from "@boring-dev/core";\n${tags.join("\n")}\n`,
        map: null,
      };
    },

    configureServer(server) {
      // A new or removed job changes the virtual server module.
      const structural = /app\/features\/[^/]+\/jobs\//;
      const refresh = (path) => {
        if (!structural.test(posix(path))) return;
        for (const id of [CLIENT, SERVER]) {
          const mod = server.moduleGraph.getModuleById(`\0${id}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh).on("unlink", refresh);

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "/").split("?")[0];
        const internal =
          path.startsWith("/@") || path.startsWith("/__vite") || path.startsWith("/node_modules/");
        if (internal || /\.\w+$/.test(path)) return next();

        try {
          const { manifest } = await server.ssrLoadModule(SERVER);
          const handler = await server.ssrLoadModule("@boring-dev/node/handler");

          if (path === "/__boring/graph") {
            res.setHeader("content-type", "application/json");
            return res.end(JSON.stringify(handler.describe(manifest), null, 2));
          }

          const hasBody = req.method !== "GET" && req.method !== "HEAD";
          const request = new Request(new URL(req.url, `http://${req.headers.host}`), {
            method: req.method,
            headers: new Headers(
              Object.entries(req.headers).filter(([, value]) => typeof value === "string"),
            ),
            body: hasBody ? Readable.toWeb(req) : undefined,
            duplex: hasBody ? "half" : undefined,
          });

          const response = await handler.handle(request, {
            root,
            manifest,
            styles: ["/app/styles.css"].filter((href) => existsSync(join(root, href))),
            clientEntry: `/@id/${CLIENT}`,
            transformHtml: (url, html) => server.transformIndexHtml(url, html),
          });

          res.statusCode = response.status;
          for (const [name, value] of response.headers) if (name !== "set-cookie") res.setHeader(name, value);
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader("set-cookie", cookies);
          res.end(await response.text());
        } catch (error) {
          server.ssrFixStacktrace(error);
          next(error);
        }
      });
    },
  };
}
