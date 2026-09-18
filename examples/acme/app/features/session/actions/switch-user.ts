import { action, invalid, success } from "@boring/core";
import { z } from "zod";
import { SESSION_COOKIE } from "@/shared/auth";
import { SessionPolicy } from "../policies/session";
import { Account } from "../resource";

export const switchUser = action({
  input: z.object({ userId: z.string().min(1, "Pick someone") }),
  policy: SessionPolicy.switch,
  run: ({ input, cookies }) => {
    if (!Account.exists(input.userId)) return invalid({ userId: "No such user" });
    cookies.set(SESSION_COOKIE, input.userId);
    // Everything was loaded as someone else.
    return success(null, { redirect: "/customers", invalidate: ["Customer", "Account"] });
  },
});
