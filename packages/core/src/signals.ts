/** Minimal signals: enough for ephemeral and derived client state. */
type Subscriber = () => void;

let activeComputed: Computed<unknown> | null = null;

export class Signal<T> {
  protected current: T;
  private subscribers = new Set<Subscriber>();

  constructor(initial: T) {
    this.current = initial;
  }

  get value(): T {
    activeComputed?.track(this);
    return this.current;
  }

  set value(next: T) {
    if (Object.is(next, this.current)) return;
    this.current = next;
    this.notify();
  }

  peek(): T {
    return this.current;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  protected notify() {
    for (const fn of Array.from(this.subscribers)) fn();
  }
}

export class Computed<T> extends Signal<T> {
  private dirty = true;
  private sources = new Map<Signal<unknown>, () => void>();

  constructor(private compute: () => T) {
    super(undefined as T);
  }

  track(source: Signal<unknown>) {
    if (this.sources.has(source)) return;
    this.sources.set(
      source,
      source.subscribe(() => {
        if (this.dirty) return;
        this.dirty = true;
        this.notify();
      }),
    );
  }

  private refresh() {
    if (!this.dirty) return;
    for (const stop of this.sources.values()) stop();
    this.sources.clear();
    const previous = activeComputed;
    activeComputed = this as Computed<unknown>;
    try {
      this.current = this.compute();
    } finally {
      activeComputed = previous;
    }
    this.dirty = false;
  }

  override get value(): T {
    this.refresh();
    activeComputed?.track(this as Signal<unknown>);
    return this.current;
  }

  override set value(_: T) {
    throw new Error("computed signals are read-only");
  }

  override peek(): T {
    this.refresh();
    return this.current;
  }
}

export const signal = <T>(initial: T) => new Signal(initial);
export const computed = <T>(compute: () => T) => new Computed(compute);

export function effect(run: () => void): () => void {
  const tracker = computed(() => {
    run();
    return {};
  });
  tracker.peek();
  return tracker.subscribe(() => tracker.peek());
}
