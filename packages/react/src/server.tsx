import type { RouteTree } from "@boring/core";
import { renderToString } from "react-dom/server";
import { BoringApp, type PageState } from "./app.tsx";

export const createRender = (tree: RouteTree) => (state: PageState) =>
  renderToString(<BoringApp tree={tree} initial={state} />);
