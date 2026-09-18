import { resource } from "@boring/core";
import { db, type Database } from "@boring/node";
import { z } from "zod";
import { PLANS } from "./internal/plans";

export interface CustomerRecord {
  id: string;
  orgId: string;
  name: string;
  billingEmail: string;
  plan: (typeof PLANS)[number];
  mrr: number;
  syncedAt: string | null;
}

const COLUMNS = `id, org_id AS orgId, name, billing_email AS billingEmail, plan, mrr, synced_at AS syncedAt`;

const UpdateInput = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters"),
  billingEmail: z.string().trim().email("Enter a valid email address"),
  plan: z.enum(PLANS, { message: "Choose a plan" }),
});

export const Customer = resource("Customer", {
  reads: {
    find: (id: string) =>
      db().get<CustomerRecord>(`SELECT ${COLUMNS} FROM customers WHERE id = ?`, id) ?? null,

    list({ orgId, q = "", plan = "" }: { orgId: string; q?: string; plan?: string }) {
      return db().all<CustomerRecord>(
        `SELECT ${COLUMNS} FROM customers
         WHERE org_id = ? AND name LIKE ? AND (? = '' OR plan = ?)
         ORDER BY mrr DESC`,
        orgId,
        `%${q}%`,
        plan,
        plan,
      );
    },

    emailTaken: ({ email, exceptId }: { email: string; exceptId: string }) =>
      Boolean(db().get("SELECT 1 FROM customers WHERE billing_email = ? AND id != ?", email, exceptId)),
  },

  UpdateInput,

  update(id: string, input: z.infer<typeof UpdateInput>, { tx }: { tx: Database }) {
    tx.run(
      "UPDATE customers SET name = ?, billing_email = ?, plan = ? WHERE id = ?",
      input.name,
      input.billingEmail,
      input.plan,
      id,
    );
    return tx.get<CustomerRecord>(`SELECT ${COLUMNS} FROM customers WHERE id = ?`, id)!;
  },

  markSynced(id: string) {
    db().run("UPDATE customers SET synced_at = ? WHERE id = ?", new Date().toISOString(), id);
  },
});
