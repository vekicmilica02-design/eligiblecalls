// Cloudflare Worker "eligiblecalls-refresh": starts the "Refresh calls" GitHub workflow every 2 hours.
// Cron trigger: 17 */2 * * * (UTC). Secret: GITHUB_TOKEN, a fine-grained token limited to this
// repository with "Actions: Read and write". GitHub answers 204 when the run was queued.
const URL_DISPATCH = "https://api.github.com/repos/vekicmilica02-design/eligiblecalls/actions/workflows/refresh.yml/dispatches";

async function dispatch(env) {
  const r = await fetch(URL_DISPATCH, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "eligiblecalls-refresh-timer",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) throw new Error(`GitHub answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

export default {
  async scheduled(event, env, ctx) {
    await dispatch(env);
  },
  async fetch() {
    return new Response("eligiblecalls refresh timer: runs on a schedule, nothing to see here.\n");
  },
};
