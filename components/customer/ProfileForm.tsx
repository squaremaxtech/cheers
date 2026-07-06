"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { updateProfile } from "@/actions/account";

export default function ProfileForm({
  name,
  phone,
}: {
  name: string;
  phone: string;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    const res = await updateProfile({
      name: form.get("name"),
      phone: form.get("phone"),
    });
    setSaving(false);
    if (res.ok) toast.success("Profile saved");
    else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="p-name">
          Name
        </label>
        <input id="p-name" name="name" defaultValue={name} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="p-phone">
          Phone
        </label>
        <input
          id="p-phone"
          name="phone"
          defaultValue={phone}
          placeholder="+1 876 …"
          className="input"
        />
      </div>
      <button type="submit" className="btn-gold" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
