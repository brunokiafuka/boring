import { policy } from "@boring/core";

/** Demo only: anyone may become anyone. A real app would check credentials. */
export const SessionPolicy = policy({
  switch: () => true,
});
