import { Context, Schema } from "koishi";

export const name = "dice-dagger-heart";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  // write your plugin here
  ctx.on("message", (session) => {
    if (session.content === "!dice") {
      session.send("你掷出了一个骰子");
    }
  });
}
