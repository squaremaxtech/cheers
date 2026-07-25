"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { addTrustedContact, removeTrustedContact } from "@/actions/safety";
import { MAX_TRUSTED_CONTACTS } from "@/lib/constants";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
  notifyOn: string[];
};

const TRIGGERS = [
  { value: "session_start", label: "When a visit starts" },
  { value: "overdue", label: "If I'm late checking in" },
  { value: "alert", label: "If there's an emergency" },
] as const;

export default function TrustedContacts({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyOn, setNotifyOn] = useState<string[]>(["alert"]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addTrustedContact({ name, email, phone, notifyOn });
    setBusy(false);
    if (res.ok) {
      toast.success("Contact added — we've emailed them to confirm");
      setName("");
      setEmail("");
      setPhone("");
      setNotifyOn(["alert"]);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(contactId: string) {
    setBusy(true);
    const res = await removeTrustedContact({ contactId });
    setBusy(false);
    if (res.ok) {
      toast.success("Contact removed");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {contacts.length > 0 && (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {c.name}
                  {c.verified ? (
                    <span className="ml-2 text-xs text-success">✓ confirmed</span>
                  ) : (
                    <span className="ml-2 text-xs text-warn">awaiting confirmation</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {c.notifyOn
                    .map((n) => TRIGGERS.find((t) => t.value === n)?.label ?? n)
                    .join(", ")}
                </p>
              </div>
              <button
                type="button"
                className="btn-outline text-xs"
                disabled={busy}
                onClick={() => void remove(c.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!contacts.some((c) => c.verified) && contacts.length > 0 && (
        <p className="rounded-xl border border-warn/40 bg-warn/5 p-3 text-xs text-warn">
          A contact only receives anything once they confirm by email. Until
          then they won&apos;t be reached in an emergency.
        </p>
      )}

      {open ? (
        <form onSubmit={add} className="space-y-3 rounded-xl border border-hairline p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="t-name">
                Name
              </label>
              <input
                id="t-name"
                className="input"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="t-email">
                Email
              </label>
              <input
                id="t-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Needed to confirm them"
              />
            </div>
            <div>
              <label className="label" htmlFor="t-phone">
                Phone (optional)
              </label>
              <input
                id="t-phone"
                className="input"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <fieldset>
            <legend className="label">Contact them</legend>
            <div className="flex flex-wrap gap-3">
              {TRIGGERS.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={notifyOn.includes(t.value)}
                    onChange={(e) =>
                      setNotifyOn((prev) =>
                        e.target.checked
                          ? [...prev, t.value]
                          : prev.filter((v) => v !== t.value)
                      )
                    }
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-gold"
              disabled={busy || !name || notifyOn.length === 0}
            >
              Add contact
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        contacts.length < MAX_TRUSTED_CONTACTS && (
          <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
            Add a trusted contact
          </button>
        )
      )}
    </div>
  );
}
