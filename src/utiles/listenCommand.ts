import { Context, Session } from "koishi";
import { ensureEnabled } from "./groupEnabled";

export type CommandHandler = (
  session: Session,
  args: string[],
  rest: string,
) => Promise<unknown> | unknown;

export interface ListenCommandOptions {
  /** 默认前置中间件，保证先于 Koishi 指令系统拦截 */
  prepend?: boolean;
  /** 为 false 时不匹配前导 . / 。（避免 r 与 .r 重复处理） */
  dottedPrefix?: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 匹配指令名：可选前缀 . / 。，其后须为词边界 */
export function matchCommand(
  content: string,
  names: string[],
  dottedPrefix = true,
): { name: string; rest: string } | null {
  const trimmed = (content || "").trim();
  if (!trimmed) return null;
  const namePat = names.map(escapeRegExp).join("|");
  const prefix = dottedPrefix ? "(?:[./。])?" : "(?:/)?";
  const re = new RegExp(`^${prefix}(${namePat})(?=\\s|$)`, "i");
  const m = trimmed.match(re);
  if (!m) return null;
  return {
    name: m[1],
    rest: trimmed.slice(m[0].length).trim(),
  };
}

/**
 * 用中间件注册一条“指令”。匹配到后先做 gugu 守卫，关闭则静默吞掉。
 * handler 的返回值（字符串或消息段）会自动 session.send。
 */
export function listenCommand(
  ctx: Context,
  names: string | string[],
  handler: CommandHandler,
  options: ListenCommandOptions = {},
): void {
  const nameList = Array.isArray(names) ? names : [names];
  const dottedPrefix = options.dottedPrefix !== false;
  const prepend = options.prepend !== false;

  ctx.middleware(async (session, next) => {
    if (!session) return next();
    const matched = matchCommand(session.content || "", nameList, dottedPrefix);
    if (!matched) return next();

    if (!(await ensureEnabled(ctx, session))) return;

    const args = matched.rest ? matched.rest.split(/\s+/) : [];
    const result = await handler(session, args, matched.rest);
    if (result === undefined || result === null || result === false) return;
    if (typeof result === "string" && result.length === 0) return;
    await session.send(result as any);
  }, prepend);
}
