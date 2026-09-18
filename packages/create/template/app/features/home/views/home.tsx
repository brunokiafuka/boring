import { useSignal } from "@boring-dev/react";

export function Home() {
  const count = useSignal(0);

  return (
    <main className="welcome">
      <a className="logo" href="https://github.com/brunokiafuka/boring" aria-label="BoringJS">
        🥱
      </a>
      <h1>BoringJS</h1>
      <div className="card">
        <button type="button" onClick={() => count.value++}>
          count is {count.value}
        </button>
        <p>
          Edit <code>app/features/home/views/home.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Run <code>pnpm explain</code> to see every URL, or <code>pnpm check</code> to keep the shape honest
      </p>
    </main>
  );
}
