import type { Job } from "@boring/core";
import { shared, storage, type PendingJob } from "./context.ts";
import type { Database } from "./sqlite.ts";

export function prepareJobs(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _boring_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    run_at INTEGER NOT NULL,
    error TEXT
  )`);
}

export function enqueueJob(job: PendingJob) {
  const db = shared.database;
  if (!db) throw new Error("Jobs need a database so they can survive the request");
  const duplicate = db.get("SELECT id FROM _boring_jobs WHERE key = ? AND status = 'pending'", job.key);
  if (!duplicate) {
    db.run(
      "INSERT INTO _boring_jobs (name, payload, key, run_at) VALUES (?, ?, ?, ?)",
      job.name,
      JSON.stringify(job.payload),
      job.key,
      Date.now(),
    );
  }
  setTimeout(work, 0);
}

const pending = () => shared.database?.get("SELECT 1 FROM _boring_jobs WHERE status = 'pending'");

/** Run queued jobs until none are pending. For tests and graceful shutdown. */
export async function drainJobs() {
  while (pending()) {
    await work();
    if (pending()) await new Promise((done) => setTimeout(done, 25));
  }
}

async function work() {
  const db = shared.database;
  if (!db || shared.working) return;
  shared.working = true;
  try {
    for (;;) {
      const row = db.get(
        "SELECT * FROM _boring_jobs WHERE status = 'pending' AND run_at <= ? ORDER BY id LIMIT 1",
        Date.now(),
      );
      if (!row) break;
      const jobs: Job[] = shared.manifest?.jobs ?? [];
      const job = jobs.find((candidate) => candidate.name === row.name);
      const attempt = row.attempts + 1;
      try {
        if (!job) throw new Error(`No job named "${row.name}"`);
        const payload = job.payload.parse(JSON.parse(row.payload));
        await storage.run({ keys: new Set(), database: db }, () => job.run({ payload, attempt }));
        db.run("UPDATE _boring_jobs SET status = 'done', attempts = ? WHERE id = ?", attempt, row.id);
        console.log(`[boring] job ${row.name} done`);
      } catch (error: any) {
        const failed = !job || attempt >= job.retries;
        db.run(
          "UPDATE _boring_jobs SET status = ?, attempts = ?, run_at = ?, error = ? WHERE id = ?",
          failed ? "failed" : "pending",
          attempt,
          Date.now() + 1000 * 2 ** attempt,
          String(error?.message ?? error),
          row.id,
        );
        console.error(`[boring] job ${row.name} ${failed ? "failed" : "will retry"}: ${error?.message}`);
      }
    }
  } finally {
    shared.working = false;
  }
  const next = db.get("SELECT MIN(run_at) AS at FROM _boring_jobs WHERE status = 'pending'");
  if (next?.at) setTimeout(work, Math.max(0, next.at - Date.now()) + 10);
}
