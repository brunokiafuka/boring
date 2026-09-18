import { boring } from "@boring-dev/vite";
import { defineConfig } from "vite";
import { headTags } from "./head.js";

export default defineConfig({
  plugins: [boring(), { name: "site-head", transformIndexHtml: () => headTags }],
});
