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
    `CheersJA <${smtpConfig.auth.user ?? ""}>`
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

// Minimal branded wrapper for all notification emails. Dark theme, matching
// the site: a #171412 card on the near-black page ground, a gold wordmark and
// warm off-white body text. Table-free, inline styles only, no web fonts and
// no rgba() — the safest subset across Gmail, Outlook and Apple Mail. The
// colours are literal because an email cannot read globals.css; they track
// --color-base / --color-surface / --color-hairline / --color-gold /
// --color-ink / --color-muted / --color-faint.
export function emailLayout(title: string, bodyHtml: string): string {
  return `
  <div style="background:#0c0a09;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:560px;margin:0 auto;background:#171412;border:1px solid #2c2724;border-radius:12px;overflow:hidden;">
      <div style="border-bottom:1px solid #2c2724;padding:20px 32px;">
        <p style="color:#d6b25e;font-size:20px;letter-spacing:2px;margin:0;">CHEERSJA</p>
        <p style="color:#a89f94;font-size:12px;margin:6px 0 0;">Jamaica's events &amp; entertainment marketplace</p>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="color:#faf7f2;font-size:20px;margin:0 0 16px;">${title}</h1>
        <div style="color:#a89f94;font-size:15px;line-height:1.6;">${bodyHtml}</div>
      </div>
      <div style="border-top:1px solid #2c2724;padding:16px 32px;">
        <p style="color:#6b6259;font-size:12px;margin:0;">CheersJA &middot; Jamaica</p>
      </div>
    </div>
  </div>`;
}
