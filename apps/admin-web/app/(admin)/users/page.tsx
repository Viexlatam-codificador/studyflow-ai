import { listUsers } from "@/lib/data/users";
import { grantComplimentaryAccess, revokeAccess } from "@/lib/actions/users";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-foreground/60">{users.length} usuarios registrados.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Acceso gratuito</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name ?? "—"}</p>
                  <p className="text-foreground/50">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  {u.roles.length > 0 ? u.roles.join(", ") : <span className="text-foreground/40">STUDENT_FREE</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand-violet/10 px-2 py-0.5 text-xs font-medium text-brand-violet">
                    {u.planKey}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.roles.includes("OWNER") ? (
                    <span className="text-xs text-foreground/40">OWNER (lifetime)</span>
                  ) : u.activeSubscriptionId ? (
                    <form action={revokeAccess}>
                      <input type="hidden" name="subscription_id" value={u.activeSubscriptionId} />
                      <input type="hidden" name="user_id" value={u.id} />
                      <button type="submit" className="text-xs text-brand-urgent hover:underline">
                        Revocar
                      </button>
                    </form>
                  ) : (
                    <form action={grantComplimentaryAccess} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={u.id} />
                      <select name="plan_key" className="rounded border border-border bg-background px-2 py-1 text-xs">
                        <option value="PRO">PRO</option>
                        <option value="CAMPUS">CAMPUS</option>
                      </select>
                      <select name="source" className="rounded border border-border bg-background px-2 py-1 text-xs">
                        <option value="COMPLIMENTARY">Cortesía</option>
                        <option value="PILOT">Piloto</option>
                        <option value="SCHOLARSHIP">Beca</option>
                        <option value="LIFETIME">Lifetime</option>
                      </select>
                      <button type="submit" className="text-xs font-medium text-brand-violet hover:underline">
                        Otorgar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
