import { Context, $, Session } from "koishi";
import {} from "koishi-plugin-adapter-onebot";

/** 查询群是否启用。未记录视为启用（避免新群无法 gugu on 的悖论） */
export async function isGroupEnabled(
  ctx: Context,
  groupId: string,
): Promise<boolean> {
  const rows = await ctx.database
    .select("gugustate")
    .where((row) => $.eq(row.groupid, groupId))
    .execute();
  if (rows.length === 0) return false; // 默认关闭
  return rows[0].enabled;
}

/** 守卫：群未启用时返回 false，调用方应提前 return。
 * gugu 三命令本身不调用此守卫，始终可用。 */
export async function ensureEnabled(
  ctx: Context,
  session: Session,
): Promise<boolean> {
  if (!session.guildId) return true; // 无群上下文（私聊等），放行
  return await isGroupEnabled(ctx, session.guildId);
}

export function setGugu(ctx: Context) {
  ctx.command("gugu <action> 咕咕开关").action(async ({ session }, action) => {
    if (!session) return "无法获取用户信息。";
    const groupId = session.guildId;
    if (!groupId) return "无法获取群信息。";

    const act = (action || "").trim().toLowerCase();

    if (act === "on") {
      await ctx.database.upsert(
        "gugustate",
        [{ groupid: groupId, enabled: true }],
        "groupid",
      );
      return "早上好，今天也是元气满满的一天！";
    }

    if (act === "off") {
      await ctx.database.upsert(
        "gugustate",
        [{ groupid: groupId, enabled: false }],
        "groupid",
      );
      return "晚安，愿你有个好梦";
    }

    if (act === "leave") {
      if (session.platform === "onebot") {
        await session.onebot.setGroupLeave(groupId, false);
        return;
      }
      return "当前平台不支持退群操作";
    }

    return "未知操作，可用: on / off / leave";
  });
}
