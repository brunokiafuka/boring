import { boring } from "@boring-dev/vite";
import { defineConfig } from "vite";

/** The infrastructure shell. The application contract lives in boring.config.ts. */
export default defineConfig({
  plugins: [boring()],
});
