// lib/email.js — Brevo (Sendinblue) email helper, fully Edge-compatible
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

export async function sendEmail({ to, toName, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@desihawas.in';
  const senderName  = process.env.BREVO_SENDER_NAME  || 'DesiHawas';

  if (!apiKey) throw new Error('BREVO_API_KEY not configured');

  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Brevo error: ${res.status}`);
  }
  return res.json();
}

// ── OTP Email Template ──────────────────────────────────────────────────────
export function otpEmailHtml(otp, displayName) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your OTP - DesiHawas</title></head>
<body style="margin:0;padding:0;background:#0a000f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a000f;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a0030,#0d0020);border:1px solid rgba(236,72,153,.25);border-radius:20px;overflow:hidden;max-width:90vw;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:28px 32px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;">💜 DesiHawas</div>
          <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Email Verification</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:6px;">Hi ${displayName || 'there'} 👋</div>
          <div style="font-size:14px;color:rgba(255,255,255,.55);margin-bottom:28px;line-height:1.6;">Your one-time verification code is below.<br>Enter it to complete your registration.</div>
          <!-- OTP Box -->
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(236,72,153,.35);border-radius:14px;padding:24px 16px;margin:0 auto 24px;display:inline-block;min-width:220px;">
            <div style="letter-spacing:14px;font-size:38px;font-weight:900;color:#fff;font-family:monospace;text-indent:14px;">${otp}</div>
          </div>
          <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;font-size:13px;color:#fbbf24;margin-bottom:24px;">
            ⏱ Valid for <strong>10 minutes</strong> only
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.3);line-height:1.7;">
            If you didn't request this, please ignore this email.<br>
            Never share this code with anyone.
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.06);text-align:center;">
          <div style="font-size:11px;color:rgba(255,255,255,.25);">© DesiHawas · Secure &amp; Private · No reply to this email</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Reset Password Email Template ───────────────────────────────────────────
export function resetEmailHtml(resetUrl, displayName) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset Password - DesiHawas</title></head>
<body style="margin:0;padding:0;background:#0a000f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a000f;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a0030,#0d0020);border:1px solid rgba(236,72,153,.25);border-radius:20px;overflow:hidden;max-width:90vw;">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:28px 32px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;">💜 DesiHawas</div>
          <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Password Reset</div>
        </td></tr>
        <tr><td style="padding:36px 32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:12px;">🔐</div>
          <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px;">Hi ${displayName || 'there'}</div>
          <div style="font-size:14px;color:rgba(255,255,255,.55);margin-bottom:28px;line-height:1.6;">We received a request to reset your DesiHawas password.<br>Click the button below to set a new password.</div>
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 36px;border-radius:12px;margin-bottom:20px;">
            🔑 Reset My Password
          </a>
          <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;font-size:13px;color:#fbbf24;margin-bottom:20px;">
            ⏱ This link expires in <strong>20 minutes</strong>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,.3);line-height:1.7;word-break:break-all;">
            Or copy this link: <span style="color:rgba(167,139,250,.6);">${resetUrl}</span><br><br>
            If you didn't request this, your account is safe — ignore this email.
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.06);text-align:center;">
          <div style="font-size:11px;color:rgba(255,255,255,.25);">© DesiHawas · No reply to this email</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
