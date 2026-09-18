import * as React from "react/jsx-dev-runtime";
import { adaptForm, Fragment } from "./jsx.ts";

export type { JSX } from "./jsx-types.ts";
export { Fragment };

export function jsxDEV(type: any, props: any, key: any, isStatic: boolean, source: any, self: any) {
  const next = adaptForm(type, props);
  if (!next.adapted) return React.jsxDEV(type, props, key, isStatic, source, self);
  const { __action, __children, ...rest } = next.props;
  const hidden = React.jsxDEV(
    "input",
    { type: "hidden", name: "_action", value: __action },
    "_action",
    false,
    source,
    self,
  );
  const body = React.jsxDEV(Fragment, { children: __children }, "body", isStatic, source, self);
  return React.jsxDEV("form", { ...rest, children: [hidden, body] }, key, true, source, self);
}
