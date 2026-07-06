import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

// Fire-and-forget email. A failed email must never break a mutation,
// so this logs and swallows errors instead of throwing.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? `Cheers <${process.env.EMAIL_SERVER_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (error) {
    console.error(
      "sendEmail failed:",
      error instanceof Error ? error.message : error
    );
  }
}

// Minimal branded wrapper for all notification emails.
export function emailLayout(title: string, bodyHtml: string): string {
  return `
  <div style="background:#0c0a09;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:520px;margin:0 auto;background:#1c1917;border:1px solid #292524;border-radius:12px;padding:32px;">
      <p style="color:#d6b25e;font-size:22px;letter-spacing:2px;margin:0 0 24px;">CHEERS</p>
      <h1 style="color:#fafaf9;font-size:20px;margin:0 0 16px;">${title}</h1>
      <div style="color:#a8a29e;font-size:15px;line-height:1.6;">${bodyHtml}</div>
      <p style="color:#57534e;font-size:12px;margin:32px 0 0;">Cheers &middot; Jamaica</p>
    </div>
  </div>`;
}
