// Transactional e-mail (sign-in links, invitations) through the Resend HTTP API.
// Settings: RESEND_API_KEY (secret), EMAIL_FROM (e.g. "Eligible Calls <login@eligiblecalls.com>"; the domain
// must be verified in Resend). Without a key the API answers 503 email_unavailable, except in local
// development where DEV_LOGIN_LINKS = "1" returns the link in the response instead of sending it.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const TEXT = {
  en: {
    signinSubject: "Your Eligible Calls sign-in link",
    signinBody: (link, min) => `Use this link to sign in to Eligible Calls. It works once and expires in ${min} minutes.\n\n${link}\n\nIf you did not ask for it, ignore this e-mail.`,
    inviteSubject: (org) => `You were added to ${org} on Eligible Calls`,
    inviteBody: (org, link) => `You were added to the organisation "${org}" on Eligible Calls. Sign in with this e-mail address to open it:\n\n${link}`,
  },
  sr: {
    signinSubject: "Vaš link za prijavu na Eligible Calls",
    signinBody: (link, min) => `Prijavite se na Eligible Calls preko ovog linka. Važi jednom i ističe za ${min} minuta.\n\n${link}\n\nAko niste tražili prijavu, zanemarite ovaj e-mail.`,
    inviteSubject: (org) => `Dodati ste u organizaciju ${org} na Eligible Calls`,
    inviteBody: (org, link) => `Dodati ste u organizaciju „${org}" na Eligible Calls. Prijavite se ovom e-mail adresom da je otvorite:\n\n${link}`,
  },
};
export const mailText = (lang) => TEXT[lang === "sr" ? "sr" : "en"];

export async function sendEmail(env, { to, subject, text }, fetchImpl = fetch) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { sent: false, reason: "not_configured" };
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}</div>`;
  const r = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.RESEND_API_KEY },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!r.ok) return { sent: false, reason: "provider_" + r.status };
  return { sent: true };
}
