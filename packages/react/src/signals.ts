import { computed, signal, type Signal } from "@boring-dev/core";
import { useState, useSyncExternalStore } from "react";

/** Subscribes this component to a signal and returns its value. */
export function useSignalValue<T>(source: Signal<T>): T {
  return useSyncExternalStore(
    (notify) => source.subscribe(notify),
    () => source.peek(),
    () => source.peek(),
  );
}

/** Component-local ephemeral state. Reading `.value` during render is safe. */
export function useSignal<T>(initial: T): Signal<T> {
  const [own] = useState(() => signal(initial));
  useSignalValue(own);
  return own;
}

/**
 * Derived state. `compute` is captured on first render; it recomputes whenever a
 * signal it read changes, so read signals inside it rather than closing over props.
 */
export function useComputed<T>(compute: () => T): Signal<T> {
  const [own] = useState(() => computed(compute));
  useSignalValue(own);
  return own;
}
