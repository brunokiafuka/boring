import { defineBoring, signals } from "@boring-dev/core";
import { react } from "@boring-dev/react";

/** The marketing site is itself a Boring app: no database, no users, every route open. */
export default defineBoring({
  runtime: "node",
  view: react(),
  state: signals(),
  conventions: {
    serverFirst: true,
    preferComposition: true,
    globalState: "discouraged",
    duplicatePatterns: "error",
  },
});
