import { loadChatAccess } from "@/lib/chat-access";
import { GuardError, requireUser, requireWorker } from "@/lib/guards";
import {
  isUploadKind,
  maxBytesFor,
  saveUpload,
} from "@/lib/uploads";
import type { UploadKind } from "@/lib/uploads";

// Upload sink. The form's "kind" field picks the destination and who may use
// it:
//   media (default) → uploads/users/<userId>/   (worker profile photos/videos)
//   receipt         → uploads/receipts/         (worker cash proofs / evidence)
//   identity        → uploads/identity/<userId>/ (customer ID documents)
//   chat            → uploads/chat/<roomId>/     (chat images; needs roomId +
//                                                 room participation)
export async function POST(req: Request): Promise<Response> {
  let file: unknown;
  let kind: UploadKind = "media";
  let roomId: unknown = null;
  try {
    const form = await req.formData();
    file = form.get("file");
    const rawKind = form.get("kind");
    if (rawKind !== null) {
      if (!isUploadKind(rawKind)) {
        return Response.json({ error: "invalid upload kind" }, { status: 400 });
      }
      kind = rawKind;
    }
    roomId = form.get("roomId");
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }

  // Destination folder id, resolved together with authorization per kind.
  let folderId: string;
  try {
    if (kind === "chat") {
      const user = await requireUser();
      if (typeof roomId !== "string" || roomId.length === 0) {
        return Response.json({ error: "missing roomId" }, { status: 400 });
      }
      const access = await loadChatAccess(user, roomId);
      // Staff read chats but never post into them — images included.
      if (!access || access.viewerRole === "staff") {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      folderId = access.room.id;
    } else if (kind === "identity") {
      const user = await requireUser();
      folderId = user.id;
    } else {
      const { user } = await requireWorker();
      folderId = user.id;
    }
  } catch (error) {
    if (error instanceof GuardError) {
      return Response.json({ error: error.code }, { status: 403 });
    }
    throw error;
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "no file provided" }, { status: 400 });
  }
  const maxBytes = maxBytesFor(kind);
  if (file.size > maxBytes) {
    return Response.json(
      { error: `file too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)` },
      { status: 413 }
    );
  }

  try {
    const url = await saveUpload(file, folderId, kind);
    return Response.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "upload failed";
    const status = message === "unsupported file type" ? 415 : 500;
    return Response.json({ error: message }, { status });
  }
}
