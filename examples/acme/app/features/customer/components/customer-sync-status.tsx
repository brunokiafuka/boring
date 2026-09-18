import { describeSync } from "../internal/sync-status";

export function CustomerSyncStatus({ syncedAt }: { syncedAt: string | null }) {
  return <p className="sync-status">{describeSync(syncedAt)}</p>;
}
