import { handleApi } from "../../src/org/api.js";

export const onRequest = (ctx) => handleApi({ request: ctx.request, env: ctx.env, waitUntil: (p) => ctx.waitUntil(p) });
