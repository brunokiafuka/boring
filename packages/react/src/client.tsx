import type { RouteTree } from "@boring/core";
import { hydrateRoot } from "react-dom/client";
import { BoringApp } from "./app.tsx";

export function start(tree: RouteTree) {
  hydrateRoot(
    document.getElementById("app")!,
    <BoringApp tree={tree} initial={(window as any).BORING_STATE} />,
  );
}
