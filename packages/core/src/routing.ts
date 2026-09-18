import type { Action, LoaderContext, PolicyRule } from "./primitives.ts";

export type Params = Record<string, string>;

/** A view or a layout. Neither takes props; layouts render <Outlet />. */
export type View = () => unknown;

/** The route tree is plain data. Nothing here depends on the filesystem. */

/** What any level of the tree may declare. Children inherit it. */
export interface Level {
  /** Every policy from the root to the leaf must allow the request. */
  policy?: PolicyRule;
  /** Loads this level's data. Layouts and views below read it with `Resource.current()`. */
  load?(ctx: LoaderContext): unknown;
}

export interface Leaf extends Level {
  view: View;
  action?: Action<any, any>;
  actions?: Record<string, Action<any, any>>;
  title?: string | ((ctx: { data: any; params: Params }) => string);
}

export interface Branch extends Level {
  layout?: View;
  children: RouteNode[];
}

export type RouteTree = Branch & { kind: "routes" };
export type RouteNode =
  | { kind: "route"; path: string; target: Leaf | Branch }
  | { kind: "index"; target: Leaf }
  | { kind: "mount"; path: string; tree: RouteTree; owner?: string }
  | { kind: "redirect"; from: string; to: string };

const leaf = (target: View | Leaf): Leaf => (typeof target === "function" ? { view: target } : target);
const isBranch = (target: Leaf | Branch): target is Branch => "children" in target;

/** Groups a route tree: a list of children, or a root branch with a layout. */
export const routes = (input: RouteNode[] | Branch): RouteTree =>
  Array.isArray(input) ? { kind: "routes", children: input } : { kind: "routes", ...input };

/** An explicit path segment: a leaf view, or a branch with children and an optional layout. */
export const route = (path: string, target: View | Leaf | Branch): RouteNode => ({
  kind: "route",
  path,
  target: typeof target === "function" || !isBranch(target) ? leaf(target) : target,
});

/** The default child of the current branch. */
export const index = (target: View | Leaf): RouteNode => ({ kind: "index", target: leaf(target) });

/** Mounts a feature-owned subtree under a prefix. The feature never learns the prefix. */
export const mount = (path: string, tree: RouteTree, owner?: string): RouteNode => ({
  kind: "mount",
  path,
  tree,
  owner,
});

/** An explicit redirect. Both paths are relative to the branch that declares it. */
export const redirect = (from: string, to: string): RouteNode => ({ kind: "redirect", from, to });

export interface CompiledLevel extends Level {
  layout?: View;
}

export interface CompiledRoute {
  path: string;
  /** Root first. The last level is the leaf itself. */
  levels: CompiledLevel[];
  leaf: Leaf;
  /** The feature whose mount this route sits under. */
  owner?: string;
}

export interface Compiled {
  routes: CompiledRoute[];
  redirects: { from: string; to: string }[];
  problems: string[];
}

const segments = (path: string) => path.split("/").filter(Boolean);
const join = (...paths: string[]) => "/" + paths.flatMap(segments).join("/");
const shape = (path: string) => join(...segments(path).map((part) => (part.startsWith(":") ? ":" : part)));

/** Static segments win over params, so /customers/new beats /customers/:id. */
const specificity = (path: string) =>
  segments(path).reduce((score, part) => score * 2 + (part.startsWith(":") ? 0 : 1), 1);

const cache = new WeakMap<RouteTree, Compiled>();

export function compile(tree: RouteTree): Compiled {
  const cached = cache.get(tree);
  if (cached) return cached;

  const out: Compiled = { routes: [], redirects: [], problems: [] };
  const checkPath = (path: string, what: string) => {
    if (!path.startsWith("/")) out.problems.push(`${what} "${path}" must start with "/"`);
  };

  const walk = (branch: Branch, prefix: string, above: CompiledLevel[], owner?: string) => {
    const levels = [...above, { layout: branch.layout, policy: branch.policy, load: branch.load }];
    if (!branch.children?.length) out.problems.push(`${prefix} is a branch with no children`);

    for (const node of branch.children ?? []) {
      if (node.kind === "redirect") {
        checkPath(node.from, "redirect");
        out.redirects.push({ from: join(prefix, node.from), to: join(prefix, node.to) });
      } else if (node.kind === "mount") {
        checkPath(node.path, "mount");
        if (node.tree?.kind !== "routes")
          out.problems.push(`mount ${node.path} found no routes() in the module it names`);
        else walk(node.tree, join(prefix, node.path), levels, node.owner ?? owner);
      } else if (node.kind === "route" && isBranch(node.target)) {
        checkPath(node.path, "route");
        walk(node.target, join(prefix, node.path), levels, owner);
      } else {
        if (node.kind === "route") checkPath(node.path, "route");
        const target = node.target as Leaf;
        const path = node.kind === "route" ? join(prefix, node.path) : join(prefix);
        const { policy, load } = target;
        out.routes.push({ path, levels: [...levels, { policy, load }], leaf: target, owner });
      }
    }
  };
  walk(tree, "/", []);

  const seen = new Map<string, string>();
  for (const { path, levels } of out.routes) {
    const twin = seen.get(shape(path));
    if (twin === path) out.problems.push(`duplicate route ${path}`);
    else if (twin) out.problems.push(`conflicting routes ${twin} and ${path} match the same URLs`);
    seen.set(shape(path), path);
    if (!levels.some((level) => level.policy)) {
      out.problems.push(`${path} has no policy anywhere in its branch, so it denies everyone`);
    }
  }
  for (const { from, to } of out.redirects) {
    if (seen.has(shape(from)))
      out.problems.push(`redirect ${from} is shadowed by a route with the same path`);
    const lands = from !== to && (seen.has(shape(to)) || out.redirects.some((other) => other.from === to));
    if (!lands) out.problems.push(`redirect ${from} → ${to} leads nowhere`);
  }

  out.routes.sort((a, b) => specificity(b.path) - specificity(a.path));
  cache.set(tree, out);
  return out;
}

export function matchPath(pattern: string, pathname: string): Params | null {
  const want = segments(pattern);
  const have = segments(pathname);
  if (want.length !== have.length) return null;
  const params: Params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) params[want[i].slice(1)] = decodeURIComponent(have[i]);
    else if (want[i] !== have[i]) return null;
  }
  return params;
}

export type Match = { route: CompiledRoute; params: Params } | { redirect: string };

export function matchRoute(compiled: Compiled, pathname: string): Match | null {
  for (const { from, to } of compiled.redirects) {
    const params = matchPath(from, pathname);
    if (params)
      return {
        redirect: join(...segments(to).map((part) => (part.startsWith(":") ? params[part.slice(1)] : part))),
      };
  }
  for (const candidate of compiled.routes) {
    const params = matchPath(candidate.path, pathname);
    if (params) return { route: candidate, params };
  }
  return null;
}

export const leafActions = (target: Leaf): Action[] => [
  ...(target.action ? [target.action] : []),
  ...Object.values(target.actions ?? {}),
];

/** The data a level sees: its own, or the nearest loaded above it. */
export function nearestData(data: unknown[], depth: number): unknown {
  for (let i = Math.min(depth, data.length - 1); i >= 0; i--) if (data[i] != null) return data[i];
  return undefined;
}

/** A resource key is stale when it, its collection, or a record under it was invalidated. */
export function isStale(keys: string[], invalidated: string[]): boolean {
  return keys.some((key) =>
    invalidated.some((bad) => key === bad || key.startsWith(bad + "/") || bad.startsWith(key + "/")),
  );
}
