import { expect, test } from "vitest";
import { allow, compile, index, matchRoute, mount, redirect, route, routes } from "../src/index.ts";

const view = (name: string) => Object.defineProperty(() => null, "name", { value: name });
const [Shell, List, Layout, Overview, Settings, Login] = [
  "Shell",
  "List",
  "Layout",
  "Overview",
  "Settings",
  "Login",
].map(view);

const customerRoutes = routes([
  index(List),
  route("/:id", {
    layout: Layout,
    load: () => ({ id: 1 }),
    children: [index(Overview), route("/settings", Settings)],
  }),
]);

const app = routes({
  layout: Shell,
  policy: allow.signedIn,
  children: [
    redirect("/", "/customers"),
    redirect("/accounts/:id", "/customers/:id"),
    mount("/customers", customerRoutes),
    mount("/session", routes([route("/login", Login)])),
  ],
});

const matched = (path: string) => {
  const match = matchRoute(compile(app), path);
  if (!match || "redirect" in match) throw new Error(`${path} did not match a route`);
  return match;
};

test("a mounted feature owns its prefix without knowing it", () => {
  expect(compile(app).problems).toEqual([]);
  expect(
    compile(app)
      .routes.map((r) => r.path)
      .toSorted(),
  ).toEqual(["/customers", "/customers/:id", "/customers/:id/settings", "/session/login"]);
});

test("index is the default child of its branch", () => {
  expect(matched("/customers").route.leaf.view).toBe(List);
  expect(matched("/customers/42").route.leaf.view).toBe(Overview);
});

test("nested routes carry params and the chain of layouts, root first", () => {
  const { route: found, params } = matched("/customers/42/settings");
  expect(params).toEqual({ id: "42" });
  expect(found.leaf.view).toBe(Settings);
  expect(found.levels.map((level) => level.layout).filter(Boolean)).toEqual([Shell, Layout]);
});

test("levels inherit policy and load from the branches above", () => {
  const { levels } = matched("/customers/42/settings").route;
  expect(levels.map((level) => level.policy?.ruleName)).toEqual([
    "allow:signedIn",
    undefined,
    undefined,
    undefined,
  ]);
  expect(levels.map((level) => Boolean(level.load))).toEqual([false, false, true, false]);
});

test("redirects are explicit and keep params", () => {
  expect(matchRoute(compile(app), "/")).toEqual({ redirect: "/customers" });
  expect(matchRoute(compile(app), "/accounts/7")).toEqual({ redirect: "/customers/7" });
  expect(matchRoute(compile(app), "/nowhere")).toBeNull();
});

test("duplicate and conflicting routes are problems, not surprises", () => {
  const open = { policy: allow.everyone };
  const problems = compile(
    routes({
      ...open,
      children: [route("/a", List), route("/a", Login), route("/b/:id", List), route("/b/:slug", Login)],
    }),
  ).problems;
  expect(problems).toEqual([
    "duplicate route /a",
    "conflicting routes /b/:id and /b/:slug match the same URLs",
  ]);
});

test("default deny, dangling redirects and empty branches are reported", () => {
  const problems = compile(
    routes([route("/open", List), redirect("/old", "/missing"), route("/empty", { children: [] })]),
  ).problems;
  expect(problems).toEqual([
    "/empty is a branch with no children",
    "/open has no policy anywhere in its branch, so it denies everyone",
    "redirect /old → /missing leads nowhere",
  ]);
});

test("a redirect lands on a param route when its target matches", () => {
  const tree = routes({
    policy: allow.everyone,
    children: [redirect("/docs", "/docs/intro"), route("/docs/:slug", List)],
  });
  expect(compile(tree).problems).toEqual([]);
  expect(matchRoute(compile(tree), "/docs")).toEqual({ redirect: "/docs/intro" });
});
