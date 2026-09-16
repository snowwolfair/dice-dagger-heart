import { Context, Session } from "koishi";
import {} from "koishi-plugin-adapter-onebot";
import { hasActiveLog } from "./commandLog";
import {
  ensureEnabled,
  isGroupEnabled,
  setGroupEnabled,
} from "../utiles/groupEnabled";

export { ensureEnabled, isGroupEnabled };

/** 机器人被拉入/加入群时落库，并设为开启。 */
async function recordJoinedGroup(ctx: Context, session: Session): Promise<void> {
  const groupId = session.guildId;
  if (!groupId) return;
  await setGroupEnabled(ctx, groupId, true);
  ctx.logger.info(`[gugu] 已记录入群 ${groupId}，状态为开启`);
}

export function setGugu(ctx: Context) {
  // 标准入群：机器人被添加到群
  ctx.on("guild-added", async (session) => {
    await recordJoinedGroup(ctx, session);
  });

  // OneBot 等适配器可能把机器人自己入群发成成员增加；sub_type=invite 为拉入
  ctx.on("guild-member-added", async (session) => {
    if (session.userId !== session.selfId) return;
    await recordJoinedGroup(ctx, session);
  });

  ctx.command("gugu <action> 咕咕开关").action(async ({ session }, action) => {
    if (!session) return "无法获取用户信息。";
    const groupId = session.guildId;
    if (!groupId) return "无法获取群信息。";

    const act = (action || "").trim().toLowerCase();

    if (act === "on") {
      await setGroupEnabled(ctx, groupId, true);
      return "咕咕已苏醒，开始响应指令";
    }

    if (act === "off") {
      // 检查是否有活跃的 log 会话（recording 或 paused）
      if (await hasActiveLog(ctx, groupId)) {
        return "当前有正在进行的日志记录，请先 log end 结束后再关闭咕咕";
      }
      await setGroupEnabled(ctx, groupId, false);
      return "咕咕了，不再响应其他指令";
    }

    if (act === "leave") {
      // 检查是否有活跃的 log 会话
      if (await hasActiveLog(ctx, groupId)) {
        return "当前有正在进行的日志记录，请先 log end 结束后再退出";
      }
      if (session.platform === "onebot") {
        await session.onebot.setGroupLeave(groupId, false);
        return;
      }
      return "当前平台不支持退群操作";
    }

    return "未知操作，可用: on / off / leave";
  });
}
