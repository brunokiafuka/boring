/**
 * Tags every page carries in <head>. Shared by the dev server (vite.config.ts) and the
 * static export (scripts/prerender.js) so both produce the same document.
 */

// The theme lives on <html data-theme>. Applied before first paint, toggled by the header
// button, remembered in localStorage. Plain script, so it works with no hydration at all.
const theme = `
(function () {
  var root = document.documentElement;
  try { var t = localStorage.getItem("theme"); if (t) root.dataset.theme = t; } catch (e) {}
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".theme-toggle")) return;
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });
})();`;

/** In Vite's transformIndexHtml shape. */
export const headTags = [
  { tag: "link", attrs: { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }, injectTo: "head" },
  { tag: "script", children: theme, injectTo: "head" },
];

/** The same tags as HTML, for the static export. */
export const headHtml = headTags
  .map(({ tag, attrs = {}, children = "" }) => {
    const attributes = Object.entries(attrs)
      .map(([name, value]) => ` ${name}="${value}"`)
      .join("");
    return tag === "link" ? `<${tag}${attributes} />` : `<${tag}${attributes}>${children}</${tag}>`;
  })
  .join("\n    ");
