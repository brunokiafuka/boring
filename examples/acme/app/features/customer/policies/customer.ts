import { policy, type PolicyContext } from "@boring/core";
import type { User } from "@/shared/auth";
import type { CustomerRecord } from "../resource";

type Ctx = PolicyContext<User, CustomerRecord>;

export const CustomerPolicy = policy({
  view: ({ user, record }: Ctx) => user?.orgId === record.orgId,
  update: ({ user, record }: Ctx) => user?.orgId === record.orgId && user.role !== "viewer",
});
