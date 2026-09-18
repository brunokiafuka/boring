import { resource } from "@boring/core";
import { db } from "@boring/node";
import type { User } from "@/shared/auth";

export const Account = resource("Account", {
  reads: {
    list: () => db().all<User>("SELECT id, name, role, org_id AS orgId FROM users ORDER BY org_id, name"),
    exists: (id: string) => Boolean(db().get("SELECT 1 FROM users WHERE id = ?", id)),
  },
});
