import { allow, index, routes } from "@boring-dev/core";
import { Landing } from "./views/landing";

export const marketingRoutes = routes({
  policy: allow.everyone,
  children: [
    index({ view: Landing, title: "BoringJS: software should be boring. Start with your frontend." }),
  ],
});
