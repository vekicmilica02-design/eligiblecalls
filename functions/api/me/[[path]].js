// /api/me/<anything> (for example /api/me/ai, the AI actions left today). /api/me itself is answered by ../me.js.
import { handleApi } from "../../../src/org/api.js";

export const onRequest = (ctx) => handleApi({ request: ctx.request, env: ctx.env, waitUntil: (p) => ctx.waitUntil(p) });
