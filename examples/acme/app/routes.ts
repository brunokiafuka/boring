import { mount, redirect, routes } from "@boring-dev/core";
import { customerRoutes } from "@/features/customer";
import { sessionRoutes } from "@/features/session";
import { AppShell } from "./layout";

/** Every URL in the application, in one place. Features own what is under their mount. */
export default routes({
  layout: AppShell,

  children: [
    redirect("/", "/customers"),
    mount("/customers", customerRoutes),
    mount("/session", sessionRoutes),
  ],
});
