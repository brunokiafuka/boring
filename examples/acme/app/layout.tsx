import { Outlet, useUser } from "@boring/react";
import type { User } from "@/shared/auth";

export function AppShell() {
  const user = useUser<User>();

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/customers">
          <span className="brand-mark">A</span> Acme Billing
        </a>
        <nav>
          <a href="/customers">Customers</a>
          <a href="/session">{user ? `${user.name} · ${user.role}` : "Sign in"}</a>
        </nav>
      </header>
      <div className="progress" />
      <main>
        <Outlet />
      </main>
      <footer>An example app on BoringJS. Try it with JavaScript disabled.</footer>
    </div>
  );
}
