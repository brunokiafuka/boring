import { AsyncLocalStorage } from "node:async_hooks";
import { internals } from "@boring/core";
import type { Database } from "./sqlite.ts";

export interface PendingJob {
  name: string;
  payload: unknown;
  key: string;
}

export interface RequestStore {
  keys: Set<string>;
  database?: Database;
  /** Set while an action runs: jobs wait here until the transaction commits. */
  pendingJobs?: PendingJob[];
}

/** Survives Vite re-evaluating this module in dev. */
const globals = ((globalThis as any).boringShared ??= {
  storage: new AsyncLocalStorage<RequestStore>(),
  databases: new Map<string, Database>(),
  manifest: undefined as any,
  working: false,
});

export const storage: AsyncLocalStorage<RequestStore> = globals.storage;
export const shared: {
  databases: Map<string, Database>;
  manifest: any;
  working: boolean;
  database?: Database;
} = globals;

export function installRuntime(enqueue: (job: PendingJob) => void) {
  internals.setRuntime({
    trackKey: (key) => void storage.getStore()?.keys.add(key),
    enqueue: async (name, payload, key) => {
      const store = storage.getStore();
      if (store?.pendingJobs) store.pendingJobs.push({ name, payload, key });
      else enqueue({ name, payload, key });
    },
  });
}
