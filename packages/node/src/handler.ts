import {
  compile,
  HttpError,
  leafActions,
  matchRoute,
  nearestData,
  type Action,
  type Compiled,
  type ActionResult,
  type BoringConfig,
  type Cookies,
  type Job,
  type Params,
  type PolicyRule,
  type RouteTree,
} from "@boring/core";
import { installRuntime, shared, storage, type RequestStore } from "./context.ts";
import { enqueueJob, prepareJobs } from "./jobs.ts";
import { openDatabase } from "./sqlite.ts";

export interface Manifest {
  tree: RouteTree;
  jobModules: Record<string, unknown>[];
  config: BoringConfig;
  render(state: PageState): string;
}

export interface Env {
  root: string;
  manifest: Manifest;
  styles: string[];
  clientEntry: string;
  transformHtml(url: string, html: string): Promise<string>;
  /** Tests: act as this user instead of asking config.auth. null is signed out. */
  user?: unknown;
  /** Tests: use this database file instead of the configured one. */
  databaseFile?: string;
}

/** Everything a page needs; sent as HTML on first load and as JSON afterwards. */
export interface PageState {
  url: string;
  status: number;
  title: string;
  /** One entry per level of the matched branch, root first. null where a level loads nothing. */
  data: unknown[];
  keys: string[];
  user: unknown;
  error?: { status: number; message: string };
  actionResult?: ActionResult & { actionId?: string };
}

installRuntime(enqueueJob);

const collectJobs = (modules: Record<string, unknown>[]) =>
  modules.flatMap((mod) => Object.values(mod).filter((value: any) => value?.$$boring === "job")) as Job[];

function cookieJar(request: Request) {
  const incoming = new Map(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((pair) => pair.trim().split("="))
      .filter(([name]) => name)
      .map(([name, ...rest]) => [name, decodeURIComponent(rest.join("="))] as const),
  );
  const outgoing: string[] = [];
  const cookies: Cookies = {
    get: (name) => incoming.get(name),
    set(name, value, { maxAge = 60 * 60 * 24 * 30, path = "/" } = {}) {
      incoming.set(name, value);
      outgoing.push(
        `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`,
      );
    },
  };
  return { cookies, outgoing };
}

async function authorize(
  rule: PolicyRule | undefined,
  ctx: { user: unknown; record: unknown; params: Params },
  what: string,
) {
  if (!rule) throw new HttpError(403, `${what} declares no policy. Boring denies by default.`);
  if (!(await rule(ctx))) {
    throw new HttpError(ctx.user ? 403 : 401, `${rule.ruleName ?? "policy"} does not allow this`);
  }
}

const NEEDS_RECORD = Symbol("needs record");

/**
 * Route → Policy → Resource. A rule that never reads `record` (allow.signedIn, a role check)
 * is settled before anything loads. Returns false when the rule needs the record to decide.
 */
async function authorizeBeforeLoad(
  rule: PolicyRule | undefined,
  ctx: { user: unknown; params: Params },
  what: string,
) {
  const early = {
    ...ctx,
    get record(): never {
      throw NEEDS_RECORD;
    },
  };
  try {
    await authorize(rule, early, what);
    return true;
  } catch (error) {
    if (error === NEEDS_RECORD) return false;
    throw error;
  }
}

class Rollback extends Error {
  constructor(public result: ActionResult) {
    super("rollback");
  }
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const { config } = env.manifest;
  const compiled = compile(env.manifest.tree);
  const database = config.database
    ? openDatabase({ ...config.database, file: env.databaseFile ?? config.database.file }, env.root)
    : undefined;
  if (database && shared.database !== database) prepareJobs(database);
  shared.database = database;
  shared.manifest = { jobs: collectJobs(env.manifest.jobModules) };

  const store: RequestStore = { keys: new Set(), database };
  return storage.run(store, () => respond(request, env, compiled, store));
}

async function respond(
  request: Request,
  env: Env,
  compiled: Compiled,
  store: RequestStore,
): Promise<Response> {
  const { config } = env.manifest;
  const url = new URL(request.url);
  const wantsData = request.headers.has("x-boring");
  const { cookies, outgoing } = cookieJar(request);
  const headers = () => {
    const h = new Headers();
    for (const cookie of outgoing) h.append("set-cookie", cookie);
    return h;
  };

  const state: PageState = {
    url: url.pathname + url.search,
    status: 200,
    title: "",
    data: [],
    keys: [],
    user: null,
  };

  const send = async () => {
    state.keys = [...store.keys];
    const h = headers();
    if (wantsData) {
      h.set("content-type", "application/json");
      return new Response(JSON.stringify(state), { status: state.status, headers: h });
    }
    h.set("content-type", "text/html; charset=utf-8");
    return new Response(await document(state, env), { status: state.status, headers: h });
  };

  const redirectTo = (to: string, invalidated: string[] = [], status = 303) => {
    const h = headers();
    if (wantsData) {
      h.set("content-type", "application/json");
      return new Response(JSON.stringify({ redirect: to, invalidated }), { headers: h });
    }
    h.set("location", to);
    return new Response(null, { status, headers: h });
  };

  try {
    state.user = env.user !== undefined ? env.user : ((await config.auth?.getUser(request, cookies)) ?? null);
    if (compiled.problems.length)
      throw new HttpError(500, `Invalid route tree: ${compiled.problems.join("; ")}`);
    const matched = matchRoute(compiled, url.pathname);
    if (!matched) throw new HttpError(404, `No route matches ${url.pathname}`);
    if ("redirect" in matched) return redirectTo(matched.redirect + url.search, [], 302);
    const { route, params } = matched;
    const what = `Route ${route.path}`;
    const last = route.levels.length - 1;

    // Walk the branch root-first: Route → Policy → Resource at every level.
    const load = async () => {
      store.keys.clear();
      const data: unknown[] = [];
      for (const [depth, level] of route.levels.entries()) {
        const who = { user: state.user, params };
        const settled = !level.policy || (await authorizeBeforeLoad(level.policy, who, what));
        data[depth] = null;
        if (level.load) {
          data[depth] = await level.load({ params, search: url.searchParams, user: state.user, request });
          if (data[depth] == null) throw new HttpError(404, "Not found");
        }
        if (!settled) await authorize(level.policy, { ...who, record: nearestData(data, depth) }, what);
      }
      return data;
    };

    let data = await load();
    const record = nearestData(data, last);

    if (request.method === "POST") {
      const form = await request.formData();
      const actionId = form.get("_action");
      const actions = leafActions(route.leaf);
      const act: Action | undefined = actionId ? actions.find((a) => a.$$id === actionId) : actions[0];
      if (!act) throw new HttpError(405, `${what} has no action ${actionId ?? ""}`.trim());
      await authorize(act.policy, { user: state.user, record, params }, `Action ${act.$$id}`);

      const values: Record<string, string> = {};
      for (const [name, value] of form)
        if (name !== "_action" && typeof value === "string") values[name] = value;

      const result = await runAction(
        act,
        values,
        { params, user: state.user, record, cookies, request },
        store,
      );

      if (result.type === "redirect") return redirectTo(result.to, result.invalidate);
      if (result.type === "success" && !wantsData) return redirectTo(state.url);
      if (result.type === "invalid") state.status = 422;
      state.actionResult = { ...result, actionId: act.$$id };
      // The framework renders fresh truth after every mutation.
      data = await load();
    } else if (request.method !== "GET" && request.method !== "HEAD") {
      throw new HttpError(405, "Method not allowed");
    }

    state.data = data;
    const { title = "" } = route.leaf;
    state.title = typeof title === "function" ? title({ data: nearestData(data, last), params }) : title;
  } catch (error: any) {
    if (!(error instanceof HttpError)) console.error(error);
    const status = error instanceof HttpError ? error.status : 500;
    state.status = status;
    state.error = { status, message: error?.message ?? "Something went wrong" };
    state.title = String(status);
  }
  return send();
}

async function runAction(
  act: Action,
  values: Record<string, string>,
  ctx: { params: Params; user: unknown; record: unknown; cookies: Cookies; request: Request },
  store: RequestStore,
): Promise<ActionResult> {
  const parsed = act.input.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { type: "invalid", fieldErrors, values };
  }

  store.pendingJobs = [];
  const run = async (tx: unknown) => {
    const result = await act.run({ ...ctx, input: parsed.data, tx });
    if (result.type === "invalid") throw new Rollback({ ...result, values });
    return result;
  };
  try {
    const result = await (store.database ? store.database.transaction(run) : run(undefined));
    // Jobs leave only after the write is durable.
    for (const job of store.pendingJobs) enqueueJob(job);
    return result;
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    throw error;
  } finally {
    store.pendingJobs = undefined;
  }
}

async function document(state: PageState, env: Env) {
  const app = env.manifest.render(state);
  const payload = JSON.stringify(state).replace(/</g, "\\u003c");
  const title = state.title.replace(/[<&]/g, "");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${env.styles.map((href) => `<link rel="stylesheet" href="${href}" />`).join("\n    ")}
  </head>
  <body>
    <div id="app">${app}</div>
    <script>window.BORING_STATE = ${payload}</script>
    <script type="module" src="${env.clientEntry}"></script>
  </body>
</html>`;
  return env.transformHtml(state.url, html);
}

/** The application graph, for `boring explain` and /__boring/graph. */
const named = (fn: unknown) => (fn as any)?.name || null;

export function describe(manifest: Manifest) {
  const compiled = compile(manifest.tree);
  return {
    problems: compiled.problems,
    routes: compiled.routes.map((r) => ({
      path: r.path,
      owner: r.owner ?? "app",
      view: named(r.leaf.view),
      layouts: r.levels.map((level) => named(level.layout)).filter(Boolean),
      policies: r.levels.map((level) => level.policy?.ruleName).filter(Boolean),
      loads: r.levels.filter((level) => level.load).length,
      actions: leafActions(r.leaf).map((a) => a.$$id),
    })),
    redirects: compiled.redirects,
    actions: [...new Set(compiled.routes.flatMap((r) => leafActions(r.leaf)))].map((a) => ({
      id: a.$$id,
      policy: a.policy?.ruleName ?? null,
      validates: Boolean(a.input),
    })),
    jobs: collectJobs(manifest.jobModules).map((j) => ({ name: j.name, retries: j.retries })),
  };
}
