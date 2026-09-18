import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { shared, storage } from "./context.ts";

type Value = string | number | bigint | null | Uint8Array;

export interface Database {
  all<Row = any>(sql: string, ...params: Value[]): Row[];
  get<Row = any>(sql: string, ...params: Value[]): Row | undefined;
  run(sql: string, ...params: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  exec(sql: string): void;
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
}

export interface DatabaseConfig {
  adapter: "sqlite";
  file: string;
  migrate?(db: Database): void;
}

export const sqlite = (opts: { file: string; migrate?(db: Database): void }): DatabaseConfig => ({
  adapter: "sqlite",
  ...opts,
});

export function postgres(): never {
  throw new Error("The postgres adapter is not built yet — use sqlite() for now.");
}

export function openDatabase(config: DatabaseConfig, root: string): Database {
  // ":memory:#name" gives each test app its own throwaway database.
  const memory = config.file.startsWith(":memory:");
  const file = memory ? config.file : resolve(root, config.file);
  let opened = shared.databases.get(file);
  if (!opened) {
    if (!memory) mkdirSync(dirname(file), { recursive: true });
    const conn = new DatabaseSync(memory ? ":memory:" : file);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    // One connection, so transactions take turns.
    let queue: Promise<unknown> = Promise.resolve();
    opened = {
      all: (sql, ...params) => conn.prepare(sql).all(...params) as any[],
      get: (sql, ...params) => conn.prepare(sql).get(...params) as any,
      run: (sql, ...params) => conn.prepare(sql).run(...params),
      exec: (sql) => conn.exec(sql),
      transaction(fn) {
        const result = queue.then(async () => {
          conn.exec("BEGIN IMMEDIATE");
          try {
            const value = await fn(opened!);
            conn.exec("COMMIT");
            return value;
          } catch (error) {
            conn.exec("ROLLBACK");
            throw error;
          }
        });
        queue = result.catch(() => {});
        return result;
      },
    };
    shared.databases.set(file, opened);
    config.migrate?.(opened);
  }
  return opened;
}

/** The configured database, for resources and jobs. */
export function db(): Database {
  const current = storage.getStore()?.database ?? shared.database;
  if (!current) throw new Error("No database configured in boring.config.ts");
  return current;
}
