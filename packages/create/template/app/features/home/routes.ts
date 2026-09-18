import { allow, index, routes } from "@boring-dev/core";
import { Home } from "./views/home";

/** Mounted by app/routes.ts. Nothing here knows the prefix. */
export const homeRoutes = routes([index({ view: Home, title: "BoringJS", policy: allow.everyone })]);
