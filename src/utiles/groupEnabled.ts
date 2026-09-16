import { Context, $, Session } from "koishi";

/** 查询群是否启用。未记录视为启用（避免新群无法 gugu on 的悖论） */
export async function isGroupEnabled(
  ctx: Context,
  groupId: string,
): Promise<boolean> {
  const rows = await ctx.database
    .select("groupstate")
    .where((row) => $.eq(row.groupid, groupId))
    .execute();
  if (rows.length === 0) return true; // 默认启用
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

/** 写入或更新群开关。新群会带上规则默认值 DH。 */
export async function setGroupEnabled(
  ctx: Context,
  groupId: string,
  enabled: boolean,
): Promise<void> {
  await ctx.database.upsert(
    "groupstate",
    [{ groupid: groupId, enabled }],
    "groupid",
  );
}
