import nodemailer from "nodemailer";

// SMTP settings resolve from either naming convention: EMAIL_SERVER_* (this
// project's .env.example) or SMTP_* (the owner's existing .env). Gmail defaults.
export const smtpConfig = {
  host:
    process.env.EMAIL_SERVER_HOST ?? process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.EMAIL_SERVER_PORT ?? process.env.SMTP_PORT ?? 587),
  secure:
    (process.env.SMTP_SECURE ?? "").toLowerCase() === "true" ||
    Number(process.env.EMAIL_SERVER_PORT ?? process.env.SMTP_PORT ?? 587) === 465,
  auth: {
    user: process.env.EMAIL_SERVER_USER ?? process.env.SMTP_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD ?? process.env.SMTP_PASS,
  },
};

// "Name <addr>" passes through; a bare address with stray brackets is cleaned.
function cleanFrom(raw: string): string {
  return raw.includes("<") ? raw : raw.replace(/[<>]/g, "").trim();
}

export const mailFrom = cleanFrom(
  process.env.EMAIL_FROM ??
    process.env.SMTP_FROM ??
    `Cheers <${smtpConfig.auth.user ?? ""}>`
);

const transporter = nodemailer.createTransport(smtpConfig);

// Fire-and-forget email. A failed email must never break a mutation,
// so this logs and swallows errors instead of throwing.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: mailFrom,
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

// Minimal branded wrapper for all notification emails. Light theme: a white
// card on the page background, a deep-green header band, dark body text.
// Table-free, inline styles only, no web fonts and no rgba() — the safest
// subset across Gmail, Outlook and Apple Mail.
export function emailLayout(title: string, bodyHtml: string): string {
  return `
  <div style="background:#f7f6f2;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e2da;border-radius:12px;overflow:hidden;">
      <div style="background:#0b6b4a;padding:20px 32px;">
        <p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0;">Cheers</p>
        <p style="color:#cfe4da;font-size:12px;margin:4px 0 0;">Jamaica's premium freelance platform</p>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="color:#16140f;font-size:20px;font-weight:bold;margin:0 0 16px;">${title}</h1>
        <div style="color:#3a352e;font-size:15px;line-height:1.6;">${bodyHtml}</div>
      </div>
      <div style="border-top:1px solid #e5e2da;padding:16px 32px;">
        <p style="color:#8a8478;font-size:12px;margin:0;">Cheers &middot; Jamaica</p>
      </div>
    </div>
  </div>`;
}
