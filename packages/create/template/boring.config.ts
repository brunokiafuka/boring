import { defineBoring, signals } from "@boring-dev/core";
import { react } from "@boring-dev/react";

/** The application contract. Add `database: sqlite(...)` and `auth: auth(...)` from @boring-dev/node when you need them. */
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
