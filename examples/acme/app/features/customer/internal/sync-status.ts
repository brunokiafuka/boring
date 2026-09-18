/** Fixed locale and zone, so the server and the browser render the same words. */
export const describeSync = (syncedAt: string | null) =>
  syncedAt
    ? `Last synced to billing ${new Date(syncedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC.`
    : "Not yet synced to billing.";
