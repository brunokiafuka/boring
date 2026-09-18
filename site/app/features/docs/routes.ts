import { allow, route, routes } from "@boring-dev/core";
import { DocsLayout } from "./layouts/docs-layout";
import { Doc } from "./resource";
import { DocPage } from "./views/doc-page";

/** /docs is a branch: the page list loads once for the layout, each page loads its own document. */
export const docsRoutes = routes({
  layout: DocsLayout,
  policy: allow.everyone,
  load: () => Doc.list(),

  children: [
    route("/:slug", {
      view: DocPage,
      load: ({ params }) => Doc.find(params.slug),
      title: ({ data }) => `${data.title}: BoringJS docs`,
    }),
  ],
});
