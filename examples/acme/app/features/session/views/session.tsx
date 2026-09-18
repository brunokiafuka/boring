import { useUser } from "@boring/react";
import type { User } from "@/shared/auth";
import { PageHeader } from "@/shared/ui/page-header";
import { TextField } from "@/shared/ui/text-field";
import { switchUser } from "../actions/switch-user";
import { Account } from "../resource";

export function SessionPage() {
  const users = Account.current<User[]>();
  const current = useUser<User>();
  const switching = switchUser.state();

  return (
    <>
      <PageHeader eyebrow="Session" title="Who are you?">
        Switch users to watch policies work. Vik can view Acme customers but not edit them. Oz belongs to
        another organisation and sees different data.
      </PageHeader>
      <form action={switchUser} className="stack">
        <TextField
          label="Sign in as"
          name="userId"
          defaultValue={current?.id}
          error={switching.errors.userId}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} — {user.role} at {user.orgId}
            </option>
          ))}
        </TextField>
        <div className="row">
          <button type="submit" disabled={switching.pending}>
            Switch user
          </button>
        </div>
      </form>
    </>
  );
}
