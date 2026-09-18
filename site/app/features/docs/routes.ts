import { allow, route, routes } from "@boring-dev/core";
import { Doc } from "./resource";
import { DocPage } from "./views/doc-page";

/** One page loads the document and the list around it, so the view can place it. */
export const docsRoutes = routes({
  policy: allow.everyone,

  children: [
    route("/:slug", {
      view: DocPage,
      load: ({ params }) => {
        const page = Doc.find(params.slug);
        return page && { page, pages: Doc.list() };
      },
      title: ({ data }) => `${data.page.title}: BoringJS docs`,
    }),
  ],
});
