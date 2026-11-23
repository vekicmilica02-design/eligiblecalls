import { handleQueryEn } from "../../src/queryen.js";

export const onRequestPost = (ctx) => handleQueryEn({ request: ctx.request, env: ctx.env, waitUntil: (p) => ctx.waitUntil(p) });
