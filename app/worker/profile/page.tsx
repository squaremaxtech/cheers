import type { Metadata } from "next";
import WorkerProfileForm from "@/components/worker/WorkerProfileForm";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Profile Editor" };

export default async function WorkerProfilePage() {
  const { worker } = await getWorkerContext();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-ink">Profile</h1>
      <p className="mt-1 text-sm text-muted">
        Your real name is never shown publicly.
      </p>
      <div className="card mt-6 p-6">
        <WorkerProfileForm
          mode="edit"
          initial={{
            stageName: worker.stageName,
            realName: worker.realName ?? "",
            bio: worker.bio ?? "",
            age: worker.age,
            heightCm: worker.heightCm,
            bodyType: worker.bodyType ?? "",
            languages: worker.languages,
            parish: worker.parish ?? "",
            city: worker.city ?? "",
            baseRateCents: worker.baseRateCents,
          }}
        />
      </div>
    </div>
  );
}
