import * as React from "react/jsx-runtime";
import { adaptForm, Fragment } from "./jsx.ts";

export type { JSX } from "./jsx-types.ts";
export { Fragment };

function form({ __action, __children, ...rest }: any, key?: string) {
  const hidden = React.jsx("input", { type: "hidden", name: "_action", value: __action }, "_action");
  const body = React.jsx(Fragment, { children: __children }, "body");
  return React.jsxs("form", { ...rest, children: [hidden, body] }, key);
}

export function jsx(type: any, props: any, key?: string) {
  const next = adaptForm(type, props);
  return next.adapted ? form(next.props, key) : React.jsx(type, props, key);
}

export function jsxs(type: any, props: any, key?: string) {
  const next = adaptForm(type, props);
  return next.adapted ? form(next.props, key) : React.jsxs(type, props, key);
}
