import { handleChat } from "../../src/chat.js";

export const onRequestPost = (ctx) => handleChat({ request: ctx.request, env: ctx.env, waitUntil: (p) => ctx.waitUntil(p) });
