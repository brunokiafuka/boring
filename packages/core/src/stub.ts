/**
 * Client-side stand-ins for server-only modules. @boring/vite swaps
 * actions, policies, jobs and resources for these in the browser bundle.
 */
import { internals } from "./primitives.ts";

export function serverOnly(name: string): any {
  const target = function () {
    throw new Error(`${name} is server-only and cannot run in the browser`);
  };
  return new Proxy(target, {
    get(_, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "$$typeof") return undefined;
      if (prop === "current") return () => internals.viewReaders().current();
      return serverOnly(`${name}.${prop}`);
    },
  });
}

export function actionRef(id: string) {
  return { $$boring: "action" as const, id, state: () => internals.viewReaders().actionState(id) };
}
