import {
  internals,
  compile,
  isStale,
  matchRoute,
  nearestData,
  type ActionResult,
  type RouteTree,
} from "@boring/core";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";

export interface PageState {
  url: string;
  status: number;
  title: string;
  data: unknown[];
  keys: string[];
  user: unknown;
  error?: { status: number; message: string };
  actionResult?: ActionResult & { actionId?: string };
}

type Pending = "idle" | "loading" | "submitting";

interface Router {
  state: PageState;
  /** The action id while a form is in flight. */
  submitting?: string;
}

const RouterContext = createContext<Router | null>(null);

export function useRouter(): Router {
  const router = useContext(RouterContext);
  if (!router) throw new Error("Boring hooks only work inside a route");
  return router;
}

export const useUser = <User,>() => useRouter().state.user as User | null;

/** Where a layout or view sits in the matched branch. */
interface Placement {
  /** Layouts root-first, then the view. */
  stack: { component: ComponentType<any>; depth: number; props?: object }[];
  at: number;
}
const PlacementContext = createContext<Placement>({ stack: [], at: 0 });

function Placed({ stack, at }: Placement) {
  const placement = useMemo(() => ({ stack, at }), [stack, at]);
  const entry = stack[at];
  if (!entry) return null;
  return (
    <PlacementContext.Provider value={placement}>
      {createElement(entry.component, entry.props)}
    </PlacementContext.Provider>
  );
}

/** Renders the currently active child route here. Nothing else. */
export function Outlet() {
  const { stack, at } = useContext(PlacementContext);
  return <Placed stack={stack} at={at + 1} />;
}

/** `Customer.current()` and `updateCustomer.state()` read the route through these. */
internals.setViewReaders({
  current() {
    const { stack, at } = useContext(PlacementContext);
    return nearestData(useRouter().state.data, stack[at]?.depth ?? 0);
  },
  actionState(id) {
    const { state, submitting } = useRouter();
    const result = state.actionResult?.actionId === id ? state.actionResult : undefined;
    const refused = result?.type === "invalid" ? result : undefined;
    return {
      pending: submitting === id,
      succeeded: result?.type === "success",
      errors: refused?.fieldErrors ?? {},
      formError: refused?.formError,
      values: refused?.values ?? {},
    };
  },
});

interface AppProps {
  tree: RouteTree;
  initial: PageState;
}

/** Styling hook for progress UI: `<html data-boring="loading | submitting">`. */
const setPending = (pending: Pending) => {
  if (pending === "idle") delete document.documentElement.dataset.boring;
  else document.documentElement.dataset.boring = pending;
};

const here = () => window.location.pathname + window.location.search;

const request = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, headers: { "x-boring": "1", accept: "application/json" } }).then((res) => res.json());

export function BoringApp({ tree, initial }: AppProps) {
  const [state, setState] = useState(initial);
  const [submitting, setSubmitting] = useState<string>();
  // Back/forward cache, evicted by resource key when an action invalidates.
  const cache = useRef(new Map<string, PageState>());
  const latest = useRef(0);

  const show = useCallback((next: PageState, history?: "push" | "replace") => {
    if (history === "push" && next.url !== here()) window.history.pushState(null, "", next.url);
    else if (history) window.history.replaceState(null, "", next.url);
    if (!next.error && !next.actionResult) cache.current.set(next.url, next);
    document.title = next.title;
    setState(next);
  }, []);

  const evict = useCallback((invalidated: string[]) => {
    for (const [url, entry] of cache.current) if (isStale(entry.keys, invalidated)) cache.current.delete(url);
  }, []);

  const navigate = useCallback(
    async function navigate(to: string, opts?: { replace?: boolean }): Promise<void> {
      const ticket = ++latest.current;
      setPending("loading");
      try {
        const next = await request(to);
        if (ticket !== latest.current) return;
        if (next.redirect) return navigate(next.redirect, opts);
        show(next, opts?.replace ? "replace" : "push");
        if (!opts?.replace) window.scrollTo(0, 0);
      } catch {
        window.location.assign(to);
      } finally {
        if (ticket === latest.current) setPending("idle");
      }
    },
    [show],
  );

  const submit = useCallback(
    async (body: FormData) => {
      setPending("submitting");
      setSubmitting(String(body.get("_action")));
      try {
        const next = await request(here(), { method: "POST", body });
        if (next.redirect) {
          evict(next.invalidated ?? []);
          return await navigate(next.redirect);
        }
        const result: ActionResult | undefined = next.actionResult;
        if (result?.type === "success") evict(result.invalidate);
        show(next, "replace");
      } finally {
        setPending("idle");
        setSubmitting(undefined);
      }
    },
    [evict, navigate, show],
  );

  useEffect(() => {
    cache.current.set(initial.url, initial);

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target || link.hasAttribute("download") || link.origin !== window.location.origin)
        return;
      event.preventDefault();
      void navigate(link.pathname + link.search);
    };

    const onPopState = () => {
      const url = here();
      const cached = cache.current.get(url);
      if (cached) show(cached);
      else void navigate(url, { replace: true });
    };

    // Forms stay HTML. GET forms write the URL; POST forms bound to an action submit in place.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const target = new URL(form.getAttribute("action") ?? window.location.href, window.location.href);
      if (event.defaultPrevented || form.target || target.origin !== window.location.origin) return;
      const body = new FormData(form, event.submitter);
      if (form.method === "post") {
        if (!body.has("_action")) return;
        event.preventDefault();
        return void submit(body);
      }
      event.preventDefault();
      const search = new URLSearchParams();
      for (const [name, value] of body) if (typeof value === "string" && value) search.append(name, value);
      const query = search.toString();
      void navigate(target.pathname + (query ? `?${query}` : ""));
    };

    document.addEventListener("submit", onSubmit);
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, [initial, navigate, show, submit]);

  const router = useMemo(() => ({ state, submitting }), [state, submitting]);
  const matched = state.error ? null : matchRoute(compile(tree), state.url.split("?")[0]);

  let stack: Placement["stack"];
  if (matched && "route" in matched) {
    const { levels, leaf } = matched.route;
    stack = levels.flatMap((level, depth) =>
      level.layout ? [{ component: level.layout as ComponentType, depth }] : [],
    );
    stack.push({ component: leaf.view as ComponentType, depth: levels.length - 1 });
  } else {
    // Errors still render inside the application shell.
    const error = state.error ?? { status: 404, message: "Not found" };
    stack = tree.layout ? [{ component: tree.layout as ComponentType, depth: 0 }] : [];
    stack.push({ component: ErrorPage, depth: 0, props: error });
  }

  return (
    <RouterContext.Provider value={router}>
      <Placed stack={stack} at={0} />
    </RouterContext.Provider>
  );
}

function ErrorPage({ status, message }: { status: number; message: string }) {
  return (
    <section className="boring-error">
      <p className="boring-error-status">{status}</p>
      <h1>
        {status === 404
          ? "Nothing here"
          : status === 403 || status === 401
            ? "Not allowed"
            : "Something broke"}
      </h1>
      <p>{message}</p>
      <a href="/">Back to start</a>
    </section>
  );
}
