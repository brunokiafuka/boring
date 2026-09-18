import { boring } from "@boring-dev/vite";
import { defineConfig } from "vite";

/** The saved theme must apply before first paint, so it is a head script rather than component state. */
const applyTheme = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default defineConfig({
  plugins: [
    boring(),
    {
      name: "site-head",
      transformIndexHtml: () => [
        {
          tag: "link",
          attrs: { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
          injectTo: "head",
        },
        { tag: "script", children: applyTheme, injectTo: "head" },
      ],
    },
  ],
});
