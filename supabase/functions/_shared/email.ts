/**
 * Transactional email through Resend, and every template the app sends.
 *
 * One layout, many messages. The layout is table-based with inline styles on
 * purpose: Gmail strips <style> in some views and Outlook renders with Word, so
 * anything that relies on CSS classes, flexbox or web fonts falls apart there.
 *
 * Copy rules, kept here because they apply to every template:
 *   - Say what happened in the first line. No "We hope this finds you well".
 *   - One action per email, at most.
 *   - No emoji, no exclamation marks in subjects, no marketing in security mail.
 *
 * Sending never throws. Callers treat email as a side effect of something that
 * already happened (a hub ending, an account going), and a Resend outage must
 * not turn that into a failure the user sees. `sendEmail` reports success as a
 * boolean and logs the rest.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/** Must be on a domain verified in Resend (meandyou.tech is). */
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Me&u <hello@meandyou.tech>';

/**
 * Where replies, feedback and safety reports land. Also the child safety
 * contact published at meandyou.tech/child-safety — keep the two in step.
 */
export const SUPPORT_INBOX = Deno.env.get('SUPPORT_INBOX') ?? 'philipelias16@gmail.com';

const SITE = 'https://www.meandyou.tech';
const BANNER_URL = `${SITE}/images/email-banner.png`;

const color = {
  page: '#F4EFF4',
  card: '#FFFFFF',
  bannerFallback: '#FCEDF2',
  text: '#221A2B',
  muted: '#7B7286',
  faint: '#A9A2B3',
  border: '#EDE6EC',
  rose: '#F0546F',
  sunken: '#FBF8FA',
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type Email = {
  subject: string;
  html: string;
  text: string;
};

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function sendEmail(input: {
  to: string;
  email: Email;
  replyTo?: string;
  /** Resend de-duplicates sends that share a key for 24 hours. */
  idempotencyKey?: string;
  /** Shows up in Resend's dashboard for filtering. Letters, digits, _ and - only. */
  tag: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error(JSON.stringify({ level: 'error', event: 'email.no_key', tag: input.tag }));
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        reply_to: input.replyTo ?? SUPPORT_INBOX,
        subject: input.email.subject,
        html: input.email.html,
        text: input.email.text,
        tags: [{ name: 'kind', value: input.tag }],
      }),
    });

    if (!res.ok) {
      // The body is Resend's error, which names the problem (unverified domain,
      // bad address) without echoing the recipient.
      const detail = await res.text().catch(() => '');
      console.error(
        JSON.stringify({ level: 'error', event: 'email.failed', tag: input.tag, status: res.status, detail })
      );
      return false;
    }
    console.log(JSON.stringify({ level: 'info', event: 'email.sent', tag: input.tag }));
    return true;
  } catch (thrown) {
    console.error(JSON.stringify({ level: 'error', event: 'email.failed', tag: input.tag, message: String(thrown) }));
    return false;
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "Hi Sarah," or "Hi," — the profile default 'You' is not a name. */
function greeting(name?: string | null): string {
  const clean = name?.trim();
  return clean && clean !== 'You' ? `Hi ${clean},` : 'Hi,';
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${color.text};">${html}</p>`;
}

function small(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:14px;line-height:1.6;color:${color.muted};">${html}</p>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${color.text};">${escapeHtml(text)}</h1>`;
}

function button(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr>
      <td style="border-radius:999px;background:${color.rose};">
        <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** The reset code: large, spaced, and selectable as one string. */
function codeBlock(code: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">
    <tr>
      <td align="center" style="background:${color.sunken};border:1px solid ${color.border};border-radius:14px;padding:22px 12px;">
        <span style="font-family:'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;font-size:34px;font-weight:700;letter-spacing:10px;padding-left:10px;color:${color.text};">${escapeHtml(code)}</span>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<div style="height:1px;background:${color.border};margin:8px 0 20px;line-height:1px;font-size:1px;">&nbsp;</div>`;
}

/**
 * The shell every email shares: banner, white card, quiet footer.
 *
 * `preheader` is the grey preview line inbox lists show after the subject. It
 * is hidden in the body, and padded so the client doesn't pull body text into
 * the preview after it.
 */
function layout(input: { preheader: string; body: string; footerNote?: string }): string {
  const footerNote =
    input.footerNote ?? 'You’re receiving this because you have a Me&amp;u account.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Me&amp;u</title>
</head>
<body style="margin:0;padding:0;background:${color.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}${'&#8199;&#847;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="background:${color.bannerFallback};border-radius:20px 20px 0 0;overflow:hidden;line-height:0;font-size:0;">
            <a href="${SITE}" style="text-decoration:none;">
              <img src="${BANNER_URL}" width="560" alt="Me&amp;u" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:20px 20px 0 0;font-family:${FONT};font-size:22px;font-weight:700;line-height:80px;color:${color.text};text-align:center;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:${color.card};border-radius:0 0 20px 20px;padding:36px 36px 28px;">
            ${input.body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 12px 0;text-align:center;">
            <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${color.faint};">${footerNote}</p>
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${color.faint};">
              Me&amp;You Technologies · Calabar, Nigeria<br>
              <a href="${SITE}/support/" style="color:${color.faint};text-decoration:underline;">Support</a> ·
              <a href="${SITE}/privacy/" style="color:${color.faint};text-decoration:underline;">Privacy</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const TEXT_FOOTER = `\n\n—\nMe&u · Me&You Technologies\nSupport: ${SITE}/support/`;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function passwordResetCodeEmail(input: { name?: string | null; code: string; minutes: number }): Email {
  const subject = `${input.code} is your Me&u reset code`;
  return {
    subject,
    html: layout({
      preheader: `Use it in the app within ${input.minutes} minutes.`,
      footerNote: 'You’re receiving this because someone asked to reset the password on your Me&amp;u account.',
      body: [
        heading('Reset your password'),
        paragraph(escapeHtml(greeting(input.name))),
        paragraph('Enter this code in the app to choose a new password.'),
        codeBlock(input.code),
        small(`It expires in ${input.minutes} minutes and works once.`),
        divider(),
        small('Didn’t ask for this? You can ignore this email. Your password stays the same unless the code is used.'),
      ].join(''),
    }),
    text:
      `${greeting(input.name)}\n\nEnter this code in the Me&u app to choose a new password:\n\n${input.code}\n\n` +
      `It expires in ${input.minutes} minutes and works once.\n\n` +
      `Didn’t ask for this? Ignore this email. Your password stays the same unless the code is used.` +
      TEXT_FOOTER,
  };
}

export function passwordChangedEmail(input: { name?: string | null }): Email {
  return {
    subject: 'Your Me&u password was changed',
    html: layout({
      preheader: 'If this was you, there’s nothing else to do.',
      body: [
        heading('Your password was changed'),
        paragraph(escapeHtml(greeting(input.name))),
        paragraph(
          'The password on your Me&amp;u account was just changed, and any other phones signed in to it have been signed out.'
        ),
        paragraph('If this was you, there’s nothing else to do.'),
        divider(),
        small(
          `If it wasn’t you, reply to this email straight away and we’ll help you secure your account.`
        ),
      ].join(''),
    }),
    text:
      `${greeting(input.name)}\n\nThe password on your Me&u account was just changed, and any other phones signed in to it have been signed out.\n\n` +
      `If this was you, there’s nothing else to do.\n\nIf it wasn’t you, reply to this email straight away and we’ll help you secure your account.` +
      TEXT_FOOTER,
  };
}

export function welcomeEmail(input: { name?: string | null }): Email {
  return {
    subject: 'Welcome to Me&u',
    html: layout({
      preheader: 'One step left: link up with your partner.',
      body: [
        heading('You’re in'),
        paragraph(escapeHtml(greeting(input.name))),
        paragraph(
          'Your account is ready. One step left: link up with your partner. Create a hub in the app and send them the six-character code, or enter theirs if they’ve already made one.'
        ),
        paragraph(
          'After that it’s simple. Check in once a day, and your streak grows when you both show up.'
        ),
        divider(),
        small('Questions, ideas or something not working? Reply to this email. A real person reads it.'),
      ].join(''),
    }),
    text:
      `${greeting(input.name)}\n\nYour Me&u account is ready. One step left: link up with your partner. ` +
      `Create a hub in the app and send them the six-character code, or enter theirs if they’ve already made one.\n\n` +
      `After that it’s simple. Check in once a day, and your streak grows when you both show up.\n\n` +
      `Questions, ideas or something not working? Reply to this email. A real person reads it.` +
      TEXT_FOOTER,
  };
}

/**
 * Sent to both people when a hub ends. `endedByYou` picks the wording: the
 * person who tapped Unpair gets a receipt, the other gets told.
 */
export function hubEndedEmail(input: { name?: string | null; endedByYou: boolean; otherName: string }): Email {
  const other = escapeHtml(input.otherName);
  const subject = input.endedByYou
    ? 'Your Me&u hub has ended'
    : `${input.otherName} ended your Me&u hub`;
  const lead = input.endedByYou
    ? `You ended your hub with ${other}.`
    : `${other} ended the hub the two of you shared.`;
  const leadText = input.endedByYou
    ? `You ended your hub with ${input.otherName}.`
    : `${input.otherName} ended the hub the two of you shared.`;

  return {
    subject,
    html: layout({
      preheader: 'Your account and your private notes are still yours.',
      body: [
        heading(input.endedByYou ? 'Your hub has ended' : 'Your hub was ended'),
        paragraph(escapeHtml(greeting(input.name))),
        paragraph(lead),
        paragraph(
          'Everything you shared in it has been deleted: the streak, check-ins, calendar, photos, details and game results.'
        ),
        paragraph(
          'Your account, your to-dos and your coach conversations are untouched. Whenever you’re ready, you can start a new hub or join one from the app.'
        ),
      ].join(''),
    }),
    text:
      `${greeting(input.name)}\n\n${leadText}\n\n` +
      `Everything you shared in it has been deleted: the streak, check-ins, calendar, photos, details and game results.\n\n` +
      `Your account, your to-dos and your coach conversations are untouched. Whenever you’re ready, you can start a new hub or join one from the app.` +
      TEXT_FOOTER,
  };
}

export function accountDeletedEmail(input: { name?: string | null }): Email {
  return {
    subject: 'Your Me&u account has been deleted',
    html: layout({
      preheader: 'This is the last email we’ll send you.',
      footerNote: 'This is the last email we’ll send to this address.',
      body: [
        heading('Your account has been deleted'),
        paragraph(escapeHtml(greeting(input.name))),
        paragraph(
          'Your Me&amp;u account and the data in it have been permanently deleted, as you asked. That includes your profile, photo, to-dos, coach conversations, and any hub nobody else was still in.'
        ),
        paragraph('Thank you for giving Me&amp;u a try.'),
        divider(),
        small('If you didn’t ask for this, reply to this email and tell us.'),
      ].join(''),
    }),
    text:
      `${greeting(input.name)}\n\nYour Me&u account and the data in it have been permanently deleted, as you asked. ` +
      `That includes your profile, photo, to-dos, coach conversations, and any hub nobody else was still in.\n\n` +
      `Thank you for giving Me&u a try.\n\nIf you didn’t ask for this, reply to this email and tell us.` +
      TEXT_FOOTER,
  };
}

/** Acknowledgement to the person who filed a safety report. */
export function safetyReportReceivedEmail(input: { name?: string | null }): Email {
  return {
    subject: 'We received your safety report',
    html: layout({
      preheader: 'We review every safety report, usually within 24 hours.',
      body: [
        heading('We received your report'),
        paragraph(escapeHtml(greeting(input.name))),
        paragraph(
          'Thank you for telling us. Your report has reached our safety team, and we review every one, usually within 24 hours.'
        ),
        paragraph('If we need more detail we’ll reply to this email. You don’t need to do anything else.'),
        divider(),
        small(
          'If someone is in immediate danger, contact your local emergency services first. In the US you can also report child exploitation to NCMEC at report.cybertip.org.'
        ),
      ].join(''),
    }),
    text:
      `${greeting(input.name)}\n\nThank you for telling us. Your report has reached our safety team, and we review every one, usually within 24 hours.\n\n` +
      `If we need more detail we’ll reply to this email. You don’t need to do anything else.\n\n` +
      `If someone is in immediate danger, contact your local emergency services first. In the US you can also report child exploitation to NCMEC at report.cybertip.org.` +
      TEXT_FOOTER,
  };
}

/** Internal: a new piece of feedback or a safety report, for the team inbox. */
export function feedbackToTeamEmail(input: {
  kind: 'feedback' | 'bug' | 'safety';
  message: string;
  feedbackId: string;
  userId: string;
  accountEmail: string | null;
  contact: string | null;
  appVersion: string | null;
  platform: string | null;
}): Email {
  const label = { feedback: 'Idea', bug: 'Problem', safety: 'SAFETY REPORT' }[input.kind];
  const subject =
    input.kind === 'safety'
      ? `[Safety] New report: review within 24 hours`
      : `[${label}] ${input.message.slice(0, 60).replace(/\s+/g, ' ')}${input.message.length > 60 ? '…' : ''}`;

  const rows: [string, string][] = [
    ['Type', label],
    ['Account email', input.accountEmail ?? '(none)'],
    ['Reply-to given', input.contact ?? '(none)'],
    ['User id', input.userId],
    ['Report id', input.feedbackId],
    ['App', [input.appVersion, input.platform].filter(Boolean).join(' · ') || '(unknown)'],
  ];

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-family:${FONT};font-size:13px;color:${color.muted};white-space:nowrap;vertical-align:top;">${k}</td>` +
        `<td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${color.text};word-break:break-all;">${escapeHtml(v)}</td></tr>`
    )
    .join('');

  const quote = `<div style="margin:0 0 24px;padding:16px 18px;background:${color.sunken};border-left:3px solid ${color.rose};border-radius:8px;font-family:${FONT};font-size:15px;line-height:1.6;color:${color.text};white-space:pre-wrap;">${escapeHtml(input.message)}</div>`;

  return {
    subject,
    html: layout({
      preheader: input.message.slice(0, 120),
      footerNote: 'Internal notification from the Me&amp;u feedback form.',
      body: [
        heading(input.kind === 'safety' ? 'New safety report' : `New ${label.toLowerCase()} from the app`),
        input.kind === 'safety'
          ? paragraph(
              '<strong>The child safety page promises review within 24 hours.</strong> Reply to this email to answer the reporter.'
            )
          : paragraph('Reply to this email to answer the sender.'),
        quote,
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${table}</table>`,
      ].join(''),
    }),
    text:
      `${input.kind === 'safety' ? 'NEW SAFETY REPORT. Review within 24 hours.' : `New ${label.toLowerCase()} from the app.`}\n\n` +
      `${input.message}\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
  };
}
