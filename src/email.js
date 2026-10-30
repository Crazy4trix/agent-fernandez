// Inquiry emails: a notification to Kevin and a confirmation to the person who wrote in.
// Sending is optional. Set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified
// with Resend, e.g. "Agent Fernandez <kevin@agentfernandez.com>") to turn it on. Without them,
// inquiries are still saved and shown in the admin inbox.
import { escape } from './html.js';
import { site } from './config.js';

const API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.EMAIL_FROM || '';
const NOTIFY_TO = process.env.EMAIL_NOTIFY_TO || site.email;

export const emailEnabled = Boolean(API_KEY && FROM);

const KIND_LABEL = { buyer: 'Buyer inquiry', seller: 'Valuation request', listing: 'Listing question', general: 'Message' };
const DETAIL_LABEL = {
  budget: 'Price range', beds: 'Bedrooms', areas: 'Areas', timeline: 'Timeline', financing: 'Financing',
  property_address: 'Property address', property_type: 'Property type', tour: 'Showing',
};

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 120);

// Table layout and inline styles: the only reliable approach across email clients.
function frame(inner) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F5F0E6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E6;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF8F2;border:1px solid #D9CFBF;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #D9CFBF;font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:3px;color:#2F2D2A;">AGENT FERNANDEZ</td></tr>
<tr><td style="padding:28px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2F2D2A;">${inner}</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #D9CFBF;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B5E50;">
${escape(site.agentName)}, ${escape(site.title)}<br>${escape(site.team)} at ${escape(site.brokerage)}<br>
<a href="mailto:${escape(site.email)}" style="color:#6B5E50;">${escape(site.email)}</a> &nbsp; <a href="${escape(site.siteUrl)}" style="color:#6B5E50;">${escape(new URL(site.siteUrl).host)}</a><br>Equal Housing Opportunity.
</td></tr></table></td></tr></table></body></html>`;
}

function rows(inquiry, listing) {
  const list = [
    ['Name', inquiry.name], ['Email', inquiry.email], ['Phone', inquiry.phone],
    listing ? ['Home', `${listing.address}`] : null,
    ...Object.entries(inquiry.details).map(([k, v]) => [DETAIL_LABEL[k] || k, v]),
  ].filter((r) => r && r[1]);
  return list;
}

export function notificationEmail(inquiry, listing) {
  const r = rows(inquiry, listing);
  const subject = `${KIND_LABEL[inquiry.kind]} from ${oneLine(inquiry.name)} | ${site.brand}`;
  const htmlBody = frame(`<p style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;">${escape(KIND_LABEL[inquiry.kind])}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
${r.map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#6B5E50;vertical-align:top;white-space:nowrap;">${escape(k)}</td><td style="padding:6px 0;">${escape(v)}</td></tr>`).join('')}
</table>
${inquiry.message ? `<p style="margin:20px 0 0;white-space:pre-wrap;">${escape(inquiry.message)}</p>` : ''}
<p style="margin:24px 0 0;"><a href="${escape(new URL('/admin/inquiries', site.siteUrl).href)}" style="color:#2F2D2A;">Open the inquiry inbox</a></p>`);
  const text = `${KIND_LABEL[inquiry.kind]}\n\n${r.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${inquiry.message || ''}`;
  return { to: NOTIFY_TO, replyTo: inquiry.email, subject, html: htmlBody, text };
}

export function confirmationEmail(inquiry, listing) {
  const first = oneLine(inquiry.name).split(' ')[0];
  const about = listing ? ` about ${listing.address}` : '';
  const subject = `Thanks, ${first}. ${site.agentName} has your message`;
  const htmlBody = frame(`<p style="margin:0 0 16px;">Hi ${escape(first)},</p>
<p style="margin:0 0 16px;">Thanks for getting in touch${escape(about)}. I’ve received your message and will reply ${escape(site.responseTime)}.</p>
<p style="margin:0 0 16px;">If it’s urgent, reply to this email and it will come straight to me.</p>
<p style="margin:0;">${escape(site.agentName)}</p>`);
  const text = `Hi ${first},\n\nThanks for getting in touch${about}. I’ve received your message and will reply ${site.responseTime}.\n\nIf it’s urgent, reply to this email and it will come straight to me.\n\n${site.agentName}\n${site.team} at ${site.brokerage}\n${site.email}`;
  return { to: inquiry.email, replyTo: site.email, subject, html: htmlBody, text };
}

async function send(message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [message.to], reply_to: message.replyTo, subject: message.subject, html: message.html, text: message.text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Email API responded ${res.status}`);
}

// Fire-and-forget: a mail outage must never lose an inquiry, which is already saved.
export function sendInquiryEmails(inquiry, listing) {
  if (!emailEnabled) return;
  Promise.allSettled([send(notificationEmail(inquiry, listing)), send(confirmationEmail(inquiry, listing))])
    .then((results) => results.forEach((r) => r.status === 'rejected' && console.error('Email failed:', r.reason.message)));
}
