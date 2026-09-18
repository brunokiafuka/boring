import { allow, index, routes } from "@boring-dev/core";
import { switchUser } from "./actions/switch-user";
import { Account } from "./resource";
import { SessionPage } from "./views/session";

export const sessionRoutes = routes([
  index({
    view: SessionPage,
    title: "Session · Acme",
    policy: allow.everyone,
    load: () => Account.list(),
    action: switchUser,
  }),
]);
