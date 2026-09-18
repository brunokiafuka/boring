import type { ZodType, z } from "zod";
import type { Params } from "./routing.ts";

/**
 * The server runtime (@boring-dev/node) installs itself here. Core stays
 * platform-free so routes and signals can load in the browser.
 */
export interface Runtime {
  trackKey(key: string): void;
  enqueue(job: string, payload: unknown, key: string): Promise<void>;
}

const noRuntime: Runtime = {
  trackKey() {},
  enqueue() {
    throw new Error("jobs need a server runtime");
  },
};
let runtime = noRuntime;

/**
 * The view adapter (@boring-dev/react) installs these, so a component can ask a
 * resource or an action about the current route without importing a helper.
 */
export interface ActionState {
  pending: boolean;
  succeeded: boolean;
  errors: FieldErrors;
  formError?: string;
  /** What the user last submitted, when it was refused. */
  values: Record<string, string>;
}
export interface ViewReaders {
  current(): unknown;
  actionState(id: string | undefined): ActionState;
}
const noView = (): never => {
  throw new Error("current() and state() only work while a view renders");
};
let readers: ViewReaders = { current: noView, actionState: noView };

const brand = <T extends object>(value: T, kind: string): T =>
  Object.defineProperty(value, "$$boring", { value: kind, enumerable: kind === "route" });

export interface PolicyContext<User = any, Record = any> {
  user: User | null;
  record: Record;
  params: Params;
}
export type PolicyRule<User = any, Record = any> = ((
  ctx: PolicyContext<User, Record>,
) => boolean | Promise<boolean>) & { ruleName?: string };

export function policy<Rules extends Record<string, PolicyRule>>(rules: Rules): Rules {
  for (const [name, rule] of Object.entries(rules)) {
    brand(rule, "policy-rule");
    rule.ruleName ??= name;
  }
  return brand(rules, "policy");
}

export const allow: { everyone: PolicyRule; signedIn: PolicyRule } = policy({
  everyone: () => true,
  signedIn: ({ user }) => user != null,
});
allow.everyone.ruleName = "allow:everyone";
allow.signedIn.ruleName = "allow:signedIn";

type Read = (...args: any[]) => unknown;

type Found<Reads> = Reads extends { find: (...args: any[]) => infer Row }
  ? NonNullable<Awaited<Row>>
  : unknown;

export type Resource<Name extends string, Reads, Rest> = Reads &
  Rest & {
    name: Name;
    key(id?: string | number): string;
    /** In a view: what the current route loaded. */
    current<Data = Found<Reads>>(): Data;
  };

export function resource<Name extends string, Reads extends Record<string, Read>, Rest extends object>(
  name: Name,
  def: { reads: Reads } & Rest,
): Resource<Name, Reads, Omit<Rest, "reads">> {
  const { reads, ...rest } = def;
  const key = (id?: string | number) => (id == null ? name : `${name}/${id}`);
  const tracked: Record<string, Read> = {};
  for (const [readName, read] of Object.entries(reads)) {
    tracked[readName] = (...args) => {
      const [first] = args;
      runtime.trackKey(typeof first === "string" || typeof first === "number" ? key(first) : key());
      return read(...args);
    };
  }
  return brand({ ...rest, ...tracked, name, key, current: () => readers.current() }, "resource") as any;
}

export type FieldErrors = Record<string, string>;
export type ActionResult<Value = unknown> =
  | { type: "success"; value: Value; invalidate: string[] }
  | { type: "redirect"; to: string; invalidate: string[] }
  | { type: "invalid"; fieldErrors: FieldErrors; formError?: string; values?: Record<string, string> };

/** The write succeeded. Optionally name the resources it made stale, and where to go next. */
export const success = <Value>(
  value: Value,
  opts: { invalidate?: string | string[]; redirect?: string } = {},
): ActionResult<Value> => {
  const invalidate = [opts.invalidate ?? []].flat();
  return opts.redirect
    ? { type: "redirect", to: opts.redirect, invalidate }
    : { type: "success", value, invalidate };
};

export const invalid = (fieldErrors: FieldErrors, formError?: string): ActionResult<never> => ({
  type: "invalid",
  fieldErrors,
  formError,
});

export interface Cookies {
  get(name: string): string | undefined;
  set(name: string, value: string, opts?: { maxAge?: number; path?: string }): void;
}

export interface ActionContext<Input, User = any, Tx = any> {
  input: Input;
  params: Params;
  user: User | null;
  record: any;
  tx: Tx;
  cookies: Cookies;
  request: Request;
}

export interface Action<Schema extends ZodType = ZodType, Value = unknown> {
  $$boring: "action";
  $$id?: string;
  input: Schema;
  policy: PolicyRule;
  run(ctx: ActionContext<z.infer<Schema>>): Promise<ActionResult<Value>> | ActionResult<Value>;
  /** In a view: how this action's last submission went. */
  state(): ActionState;
}

export function action<Schema extends ZodType, Value>(
  def: Omit<Action<Schema, Value>, "$$boring" | "$$id" | "state">,
): Action<Schema, Value> {
  const self: any = brand({ ...def, state: () => readers.actionState(self.$$id) }, "action");
  return self;
}

/** What a view holds: the real action on the server, a reference in the browser. */
export type ActionRef = { $$boring: "action"; id?: string; $$id?: string };

export interface Job<Schema extends ZodType = ZodType> {
  $$boring: "job";
  name: string;
  payload: Schema;
  retries: number;
  run(ctx: { payload: z.infer<Schema>; attempt: number }): Promise<void> | void;
  /** Idempotent by default: an identical pending payload is enqueued once. */
  enqueue(payload: z.infer<Schema>, opts?: { key?: string }): Promise<void>;
}

export function job<Schema extends ZodType>(def: {
  name: string;
  payload: Schema;
  retries?: number;
  run: Job<Schema>["run"];
}): Job<Schema> {
  return brand(
    {
      retries: 3,
      ...def,
      enqueue: (payload: z.infer<Schema>, opts: { key?: string } = {}) => {
        const parsed = def.payload.parse(payload);
        return runtime.enqueue(def.name, parsed, opts.key ?? `${def.name}:${JSON.stringify(parsed)}`);
      },
    },
    "job",
  ) as Job<Schema>;
}

export interface LoaderContext<User = any> {
  params: Params;
  search: URLSearchParams;
  user: User | null;
  request: Request;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = (message = "Not found") => new HttpError(404, message);

export interface Conventions {
  serverFirst: boolean;
  preferComposition: boolean;
  globalState: "allowed" | "discouraged" | "forbidden";
  duplicatePatterns: "off" | "warn" | "error";
}

export interface BoringConfig {
  runtime: "node";
  view: { name: string };
  state: { name: string };
  database?: any;
  auth?: { getUser(request: Request, cookies: Cookies): Promise<unknown> | unknown };
  conventions?: Partial<Conventions>;
}

export const defineBoring = (config: BoringConfig) => config;
export const signals = () => ({ name: "signals" });

/** Hooks for the framework's own packages. Applications never need these. */
export const internals = {
  /** @boring-dev/node: track resource keys and queue jobs for the current request. */
  setRuntime: (next: Runtime) => void (runtime = next),
  /** @boring-dev/react: how `Resource.current()` and `action.state()` read the route. */
  setViewReaders: (next: ViewReaders) => void (readers = next),
  viewReaders: () => readers,
  /** @boring-dev/vite, on the server: names every exported primitive so the app graph can explain it. */
  tag(value: any, id: string) {
    if (value == null || (typeof value !== "object" && typeof value !== "function")) return;
    if (!Object.isExtensible(value) || "$$id" in value) return;
    Object.defineProperty(value, "$$id", { value: id });
    if (value.$$boring === "policy") {
      const feature = id.split("/")[0];
      for (const [name, rule] of Object.entries<PolicyRule>(value)) rule.ruleName = `${feature}:${name}`;
    }
  },
};
