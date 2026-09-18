import { mount, redirect, routes } from "@boring-dev/core";
import { docsRoutes } from "@/features/docs";
import { marketingRoutes } from "@/features/marketing";
import { SiteShell } from "./layout";

/** Every URL on the site. The marketing feature owns the front, docs own /docs. */
export default routes({
  layout: SiteShell,

  children: [
    mount("/", marketingRoutes),
    redirect("/docs", "/docs/getting-started"),
    mount("/docs", docsRoutes),
  ],
});
