import { defineBoring, signals } from "@boring/core";
import { auth, sqlite } from "@boring/node";
import { react } from "@boring/react";
import { getUser } from "./app/shared/auth";
import { migrate } from "./app/db/schema";

export default defineBoring({
  runtime: "node",
  view: react(),
  state: signals(),
  database: sqlite({ file: ".boring/dev.db", migrate }),
  auth: auth({ getUser }),
  conventions: {
    serverFirst: true,
    preferComposition: true,
    globalState: "discouraged",
    duplicatePatterns: "error",
  },
});
