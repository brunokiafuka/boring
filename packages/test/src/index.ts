/**
 * The one testing style: drive the application through its real request path.
 * Policies, loaders, validation, transactions and jobs all run; nothing renders.
 */
import { manifest } from "virtual:boring/server";
// oxlint-disable-next-line import/no-unassigned-import -- types for the virtual module above
import "./virtual.d.ts";
import { nearestData, type ActionRef, type ActionResult } from "@boring-dev/core";
import { handle, type PageState } from "@boring-dev/node/handler";
import { drainJobs } from "@boring-dev/node";

export interface Visit<Data = any> {
  status: number;
  /** What the view reads with `Resource.current()`: the nearest loaded level. */
  data: Data;
  /** Set when the route tree redirected instead. */
  redirect?: string;
  /** Resource keys the loader read. */
  keys: string[];
  error?: PageState["error"];
}

export interface Submission<Data = any> extends Visit<Data> {
  result?: ActionResult;
  /** Shorthand for an `invalid` result's field errors. */
  errors: Record<string, string>;
}

let apps = 0;

/** A fresh app on its own in-memory database, migrated and seeded by boring.config.ts. */
export function testApp() {
  const databaseFile = `:memory:#${process.pid}-${++apps}`;

  const send = async (user: unknown, path: string, init?: RequestInit) => {
    const request = new Request(new URL(path, "http://boring.test"), {
      ...init,
      headers: { "x-boring": "1" },
    });
    const response = await handle(request, {
      root: process.cwd(),
      manifest,
      styles: [],
      clientEntry: "",
      transformHtml: async (_url, html) => html,
      user,
      databaseFile,
    });
    return response.json();
  };

  /** Act as this user. Pass null for a signed-out visitor. */
  const as = (user: unknown) => ({
    async visit<Data = any>(path: string): Promise<Visit<Data>> {
      const page = await send(user, path);
      if (page.redirect) return { status: 302, data: null as Data, keys: [], redirect: page.redirect };
      return {
        status: page.status,
        data: nearestData(page.data, page.data.length) as Data,
        keys: page.keys,
        error: page.error,
      };
    },

    async submit<Data = any>(
      path: string,
      action: ActionRef,
      values: Record<string, string>,
    ): Promise<Submission<Data>> {
      const body = new URLSearchParams({ ...values, _action: action.$$id ?? action.id ?? "" });
      const page = await send(user, path, { method: "POST", body });
      if (page.redirect)
        return { status: 303, data: null as Data, keys: [], errors: {}, redirect: page.redirect };
      const result: ActionResult | undefined = page.actionResult;
      return {
        status: page.status,
        data: nearestData(page.data, page.data.length) as Data,
        keys: page.keys,
        error: page.error,
        result,
        errors: result?.type === "invalid" ? result.fieldErrors : {},
      };
    },
  });

  return { as, /** Run every queued job to completion. */ jobs: { drain: drainJobs } };
}
