import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import PromoteActions from "@/components/admin/PromoteActions";
import {
  listPremiumCustomers,
  listPremiumProviders,
  searchPromotableUsers,
} from "@/lib/admin-promote";
import { getUserRow } from "@/lib/auth";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Promote — Admin" };

const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  worker: "Professional",
  driver: "Driver",
  admin: "Admin",
  support: "Support",
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// The premium tier is admin-curated. This page is the only place it is
// granted: search for an account, press one button. Support staff never see
// it — the layout hides the nav item and the redirect below closes the URL.
export default async function AdminPromotePage(
  props: PageProps<"/admin/promote">
) {
  const viewer = await getUserRow();
  if (!viewer || viewer.role !== "admin") redirect("/admin");

  const params = await props.searchParams;
  const q = firstParam(params.q)?.trim() ?? "";

  const [results, premiumCustomers, premiumProviders] = await Promise.all([
    searchPromotableUsers(q),
    listPremiumCustomers(),
    listPremiumProviders(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">Promote</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Premium services are invisible to everyone without access — no badge,
          no placeholder, no trace in search. Grant a customer{" "}
          <span className="text-ink">premium access</span> so they can see and
          book them; grant a professional{" "}
          <span className="text-ink">premium provider status</span> so they can
          publish them. There is no self-serve path and no payment path: every
          grant and every removal happens here and is recorded in the audit log
          with your name on it.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Find an account
        </h2>
        <form method="GET" className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="promote-q">
              Name, email or display name
            </label>
            <input
              id="promote-q"
              name="q"
              defaultValue={q}
              placeholder="At least 2 characters"
              className="input w-72 py-1.5"
            />
          </div>
          <button type="submit" className="btn-primary py-2 text-xs">
            Search
          </button>
          {q && (
            <Link href="/admin/promote" className="btn-ghost py-2 text-xs">
              Clear
            </Link>
          )}
        </form>

        {q.length > 0 && q.length < 2 && (
          <p className="mt-4 text-sm text-faint">
            Type at least two characters to search.
          </p>
        )}

        {q.length >= 2 && (
          <div className="card mt-4 overflow-x-auto p-2">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-faint">
                  <th className="p-3">Account</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Premium</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {results.map((row) => (
                  <tr key={row.userId}>
                    <td className="p-3">
                      <span className="font-medium text-ink">
                        {row.worker?.stageName ?? row.name ?? "Unnamed account"}
                      </span>
                      <span className="ml-2 text-faint">{row.email}</span>
                    </td>
                    <td className="p-3 text-muted">{ROLE_LABELS[row.role]}</td>
                    <td className="p-3 text-muted">
                      {row.joinedAt.toDateString()}
                    </td>
                    <td className="p-3">
                      {row.role === "customer" ? (
                        row.premiumAccessAt ? (
                          <Badge tone="gold">Premium</Badge>
                        ) : (
                          <span className="text-faint">Standard</span>
                        )
                      ) : row.role === "worker" ? (
                        row.worker === null ? (
                          <span className="text-faint">
                            No professional profile yet
                          </span>
                        ) : row.worker.premiumProviderAt ? (
                          <Badge tone="gold">Premium</Badge>
                        ) : (
                          <span className="text-faint">Standard</span>
                        )
                      ) : (
                        <span className="text-faint">
                          Sees premium as staff
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {row.role === "customer" ? (
                        <PromoteActions
                          kind="customer"
                          userId={row.userId}
                          enabled={row.premiumAccessAt !== null}
                        />
                      ) : row.role === "worker" && row.worker !== null ? (
                        <PromoteActions
                          kind="provider"
                          workerId={row.worker.id}
                          displayName={row.worker.stageName}
                          enabled={row.worker.premiumProviderAt !== null}
                        />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && (
              <p className="p-6 text-sm text-faint">
                No account matches “{q}”.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Premium customers {premiumCustomers.length > 0 && `(${premiumCustomers.length})`}
        </h2>
        <p className="mt-1 text-sm text-faint">
          These accounts can see and book premium services.
        </p>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Customer</th>
                <th className="p-3">Granted</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {premiumCustomers.map((row) => (
                <tr key={row.userId}>
                  <td className="p-3">
                    <span className="font-medium text-ink">
                      {row.name ?? "Unnamed account"}
                    </span>
                    <span className="ml-2 text-faint">{row.email}</span>
                  </td>
                  <td className="p-3 text-muted">
                    {row.grantedAt.toDateString()}
                  </td>
                  <td className="p-3">
                    <PromoteActions
                      kind="customer"
                      userId={row.userId}
                      enabled
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {premiumCustomers.length === 0 && (
            <p className="p-6 text-sm text-faint">
              Nobody holds premium access yet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Premium providers {premiumProviders.length > 0 && `(${premiumProviders.length})`}
        </h2>
        <p className="mt-1 text-sm text-faint">
          These professionals may publish premium services. Disabling one takes
          their live premium listings down with it.
        </p>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Professional</th>
                <th className="p-3">Granted</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {premiumProviders.map((row) => (
                <tr key={row.workerId}>
                  <td className="p-3">
                    <Link
                      href={`/workers/${row.slug}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {row.stageName}
                    </Link>
                    <span className="ml-2 text-faint">{row.email}</span>
                  </td>
                  <td className="p-3 text-muted">
                    {row.grantedAt.toDateString()}
                  </td>
                  <td className="p-3">
                    <PromoteActions
                      kind="provider"
                      workerId={row.workerId}
                      displayName={row.stageName}
                      enabled
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {premiumProviders.length === 0 && (
            <p className="p-6 text-sm text-faint">
              No professional offers premium services yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
