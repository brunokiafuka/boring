/** React's JSX, with one change: a <form> may point at a Boring action. */
import type { ActionRef } from "@boring-dev/core";
import type { JSX as ReactJSX } from "react";

type FormProps = ReactJSX.IntrinsicElements["form"];

export namespace JSX {
  export type ElementType = ReactJSX.ElementType;
  export interface Element extends ReactJSX.Element {}
  export interface ElementClass extends ReactJSX.ElementClass {}
  export interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
  export interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
  export type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
  export interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
  export interface IntrinsicElements extends Omit<ReactJSX.IntrinsicElements, "form"> {
    form: Omit<FormProps, "action"> & { action?: FormProps["action"] | ActionRef };
  }
}
