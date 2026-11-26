import { handleTranslateText } from "../../src/texttr.js";

export const onRequestPost = (ctx) => handleTranslateText({ request: ctx.request, env: ctx.env, waitUntil: (p) => ctx.waitUntil(p) });
