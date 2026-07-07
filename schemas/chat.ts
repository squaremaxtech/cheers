import { z } from "zod";
import { CHAT_MESSAGE_MAX_CHARS } from "@/lib/constants";

export const openChatRoomSchema = z.object({
  workerId: z.string().uuid(),
});

// Chat images only ever live on this server under the room's own folder —
// the action additionally pins the roomId inside the URL to the target room.
const chatImageUrl = z
  .string()
  .max(2000)
  .regex(
    /^\/api\/media\/chat\/[a-f0-9-]{36}\/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/,
    "Invalid image"
  );

// A message needs text, an image, or both (text doubles as the caption).
export const sendChatMessageSchema = z
  .object({
    roomId: z.string().uuid(),
    body: z
      .string()
      .trim()
      .max(
        CHAT_MESSAGE_MAX_CHARS,
        `Messages are capped at ${CHAT_MESSAGE_MAX_CHARS} characters.`
      )
      .default(""),
    imageUrl: chatImageUrl.optional(),
  })
  .refine((v) => v.body.length > 0 || v.imageUrl !== undefined, {
    message: "Type a message or attach an image.",
  });

export const markChatReadSchema = z.object({
  roomId: z.string().uuid(),
});
