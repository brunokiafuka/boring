import type { ComponentProps, ReactNode } from "react";

type Props = { label: string; error?: string; children?: ReactNode } & Omit<
  ComponentProps<"input">,
  "children"
>;

export function TextField({ label, error, children, ...rest }: Props) {
  const id = `field-${rest.name}`;
  const control = {
    ...rest,
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as Record<string, unknown>;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? <select {...control}>{children}</select> : <input {...control} />}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
