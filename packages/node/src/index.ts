import type { BoringConfig } from "@boring/core";

export { drainJobs } from "./jobs.ts";
export { db, sqlite, postgres, type Database } from "./sqlite.ts";

export const auth = <User>(
  opts: NonNullable<BoringConfig["auth"]> & { getUser(...args: any[]): User | null | Promise<User | null> },
) => opts;
