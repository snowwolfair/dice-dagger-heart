import { Context, $, Session } from "koishi";
import {
  DEFAULT_RULE_KEY,
  resolveRule,
  formatRuleList,
  getDefaultRule,
} from "../utiles/rules";
import { listenCommand } from "../utiles/listenCommand";

/** 查询群当前使用的规则集 key。未记录视为默认规则（DH） */
export async function getCurrentRule(
  ctx: Context,
  groupId: string,
): Promise<string> {
  const rows = await ctx.database
    .select("groupstate")
    .where((row) => $.eq(row.groupid, groupId))
    .execute();
  return rows.length === 0 ? DEFAULT_RULE_KEY : rows[0].rulename;
}

/** 规则守卫：当前群规则与 ruleKey 一致时返回 true。
 * 用于让指令仅在所属规则集下响应，切换规则后静默不响应。
 * 无群上下文（私聊）时放行。 */
export async function ensureRule(
  ctx: Context,
  session: Session,
  ruleKey: string,
): Promise<boolean> {
  if (!session.guildId) return true;
  const current = await getCurrentRule(ctx, session.guildId);
  return current === ruleKey;
}

export function setRule(ctx: Context) {
  listenCommand(ctx, "setrule", async (session, _args, name) => {
    const groupId = session.guildId;
    if (!groupId) return "无法获取群信息。";

    // 无参数：显示当前规则
    if (!name || !name.trim()) {
      const currentKey = await getCurrentRule(ctx, groupId);
      const current = resolveRule(currentKey) || getDefaultRule();
      ctx.logger.info(
        `[setrule] 当前规则: ${currentKey}, 可用规则: ${formatRuleList()}`,
      );
      return `当前规则集：${current.key}(${current.name})\n可用规则：${formatRuleList()}`;
    }

    ctx.logger.info(`[setrule] 尝试切换到: ${name}`);
    const rule = resolveRule(name);
    if (!rule) {
      ctx.logger.info(
        `[setrule] 未知规则: ${name}, 可用: ${formatRuleList()}`,
      );
      return `未知规则：${name}\n可用规则：${formatRuleList()}`;
    }

    await ctx.database.upsert(
      "groupstate",
      [{ groupid: groupId, rulename: rule.key }],
      "groupid",
    );
    ctx.logger.info(`[setrule] 已切换到: ${rule.key}(${rule.name})`);
    return `已切换到规则集：${rule.key}(${rule.name})\n${rule.description}`;
  });
}
