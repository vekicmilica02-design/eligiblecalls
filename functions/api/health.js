import { handleHealth } from "../../src/chat.js";

export const onRequestGet = (ctx) => handleHealth({ env: ctx.env });
