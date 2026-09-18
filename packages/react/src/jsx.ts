/**
 * The platform's <form> is the mutation client. When its `action` is a Boring
 * action, render the HTML that posts to it; the router enhances the submit.
 */
import { Fragment } from "react";

export function adaptForm(type: unknown, props: any): { props: any; adapted: boolean } {
  if (type !== "form" || props?.action?.$$boring !== "action") return { props, adapted: false };
  const { action, children, ...rest } = props;
  return {
    props: { ...rest, method: "post", __action: action.id ?? action.$$id, __children: children },
    adapted: true,
  };
}

export { Fragment };
