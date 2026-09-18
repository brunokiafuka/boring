import type { Cookies } from "@boring-dev/core";
import { db } from "@boring-dev/node";

export interface User {
  id: string;
  name: string;
  role: "admin" | "viewer";
  orgId: string;
}

export const SESSION_COOKIE = "acme_user";

/** Demo auth: the cookie names the user. A real app verifies a session here. */
export function getUser(_request: Request, cookies: Cookies): User | null {
  const id = cookies.get(SESSION_COOKIE) ?? "ada";
  return db().get<User>("SELECT id, name, role, org_id AS orgId FROM users WHERE id = ?", id) ?? null;
}
