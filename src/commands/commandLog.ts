import { Context, $, h } from "koishi";
import * as fs from "fs";
import * as path from "path";
import { listenCommand } from "../utiles/listenCommand";

// ==================== 跑团日志系统 ====================

/** 注册跑团日志命令与自动记录中间件。
 *
 * 命令（受 gugu 守卫，群关闭时不响应）：
 * - log start [名称] - 开始记录
 * - log p - 暂停记录（暂停期间不记录任何消息）
 * - log r - 恢复记录
 * - log end - 结束并导出为文件
 *
 * 中间件：log 处于 recording 状态时，记录所有消息（玩家发言 + 机器人回复）。
 * 暂停期间不包裹 session.send，不记录任何消息。
 *
 * 导出格式：兼容海豹染色器 QQ 格式
 *   名字(QQ号) 年/月/日 时:分:秒
 *   消息内容 */
export function setLog(ctx: Context) {
  listenCommand(ctx, "log", async (session, args) => {
    const groupId = session.guildId;
    if (!groupId) return "请在群聊中使用日志功能";

    const action = args[0];
    const text = args.slice(1).join(" ");

    switch (action) {
      case "start":
        return handleStart(ctx, session, groupId, text);
      case "p":
        return handlePause(ctx, session, groupId);
      case "r":
        return handleResume(ctx, session, groupId);
      case "end":
        return handleEnd(ctx, session, groupId);
      default:
        return (
          "用法：\n" +
          "log start [名称] - 开始记录\n" +
          "log p - 暂停记录\n" +
          "log r - 恢复记录\n" +
          "log end - 结束并导出"
        );
    }
  });

  // 自动记录中间件（prepend，最先执行）
  ctx.middleware(async (session, next) => {
    if (!session) return next();
    const groupId = session.guildId;
    if (!groupId) return next();

    const content = session.content?.trim() || "";
    // 排除 log 命令本身
    if (/^[。\.]?log\b/i.test(content)) return next();

    // 仅在 recording 状态下记录
    const logs = await ctx.database
      .select("dicelog")
      .where((row) => $.eq(row.groupid, groupId))
      .where((row) => $.eq(row.status, "recording"))
      .execute();

    if (logs.length === 0) return next();

    const log = logs[0];
    const username =
      session.event.user?.name || session.event.user?.id || "未知";
    const userId = session.event.user?.id || "";

    // 记录玩家发送的消息
    try {
      await ctx.database.create("dicelogline", {
        groupid: groupId,
        logname: log.logname,
        username: username,
        userid: userId,
        content: content,
        timestamp: Date.now(),
        type: "player",
      });
    } catch (e) {
      ctx.logger.warn("记录玩家消息失败", e);
    }

    // 包裹 session.send：先发送消息，再记录机器人回复
    const originalSend = session.send.bind(session);
    (session as any)._originalSend = originalSend;
    const botName = session.bot?.user?.name || session.bot?.user?.id || "骰子";
    const botId = session.bot?.selfId || session.bot?.user?.id || "";
    session.send = async (msgContent) => {
      const result = await originalSend(msgContent);
      try {
        await ctx.database.create("dicelogline", {
          groupid: groupId,
          logname: log.logname,
          username: botName,
          userid: botId,
          content: contentToString(msgContent),
          timestamp: Date.now(),
          type: "result",
        });
      } catch (e) {
        ctx.logger.warn("记录机器人回复失败", e);
      }
      return result;
    };

    return next();
  }, true);
}

/** 查询群是否有活跃的日志会话（recording 或 paused） */
export async function hasActiveLog(
  ctx: Context,
  groupId: string,
): Promise<boolean> {
  const allLogs = await ctx.database
    .select("dicelog")
    .where((row) => $.eq(row.groupid, groupId))
    .execute();
  return allLogs.some((l) => l.status !== "ended");
}

// ==================== 命令处理 ====================

/** log start [name]：创建日志会话 */
async function handleStart(
  ctx: Context,
  session: any,
  groupId: string,
  text: string,
): Promise<string> {
  if (await hasActiveLog(ctx, groupId)) {
    const allLogs = await ctx.database
      .select("dicelog")
      .where((row) => $.eq(row.groupid, groupId))
      .execute();
    const existing = allLogs.find((l) => l.status !== "ended");
    return `当前已有进行中的日志会话「${existing?.logname}」，请先 log end 结束它`;
  }

  const logname = text || new Date().toISOString().slice(0, 10);
  const userid = session.event.user?.id || "";

  await ctx.database.create("dicelog", {
    groupid: groupId,
    logname: logname,
    userid: userid,
    status: "recording",
    starttime: Date.now(),
    endtime: 0,
  });

  return (
    `日志「${logname}」已开始记录\n` +
    "期间所有消息将自动记录\n" +
    "log p 暂停 / log r 恢复 / log end 结束并导出"
  );
}

/** log p：暂停记录 */
async function handlePause(
  ctx: Context,
  session: any,
  groupId: string,
): Promise<string> {
  const logs = await ctx.database
    .select("dicelog")
    .where((row) => $.eq(row.groupid, groupId))
    .where((row) => $.eq(row.status, "recording"))
    .execute();

  if (logs.length === 0) {
    return "当前没有正在记录的日志会话";
  }

  await ctx.database.set("dicelog", { id: logs[0].id }, { status: "paused" });

  return `日志「${logs[0].logname}」已暂停，log r 恢复记录`;
}

/** log r：恢复记录 */
async function handleResume(
  ctx: Context,
  session: any,
  groupId: string,
): Promise<string> {
  const logs = await ctx.database
    .select("dicelog")
    .where((row) => $.eq(row.groupid, groupId))
    .where((row) => $.eq(row.status, "paused"))
    .execute();

  if (logs.length === 0) {
    return "当前没有暂停的日志会话";
  }

  await ctx.database.set("dicelog", { id: logs[0].id }, { status: "recording" });

  return `日志「${logs[0].logname}」已恢复记录`;
}

/** log end：结束并导出为文件 */
async function handleEnd(
  ctx: Context,
  session: any,
  groupId: string,
): Promise<string | undefined> {
  ctx.logger.info("[log end] 开始处理");

  const allLogs = await ctx.database
    .select("dicelog")
    .where((row) => $.eq(row.groupid, groupId))
    .execute();
  const logs = allLogs.filter((l) => l.status !== "ended");

  if (logs.length === 0) {
    ctx.logger.info("[log end] 没有进行中的日志会话");
    return "当前没有进行中的日志会话";
  }

  const log = logs[0];
  ctx.logger.info(`[log end] 日志名: ${log.logname}, id: ${log.id}`);

  // 标记结束
  await ctx.database.set(
    "dicelog",
    { id: log.id },
    { status: "ended", endtime: Date.now() },
  );
  ctx.logger.info("[log end] 已标记结束");

  // 查询所有条目
  const lines = await ctx.database
    .select("dicelogline")
    .where((row) => $.eq(row.groupid, groupId))
    .where((row) => $.eq(row.logname, log.logname))
    .orderBy("timestamp", "asc")
    .execute();

  ctx.logger.info(`[log end] 查询到 ${lines.length} 条记录`);

  if (lines.length === 0) {
    ctx.logger.info("[log end] 没有记录任何内容");
    return `日志「${log.logname}」没有记录任何内容`;
  }

  // 格式化日志内容
  const content = formatLogContent(lines);
  ctx.logger.info(`[log end] 格式化完成，内容长度: ${content.length}`);

  // 写文件
  const logDir = path.resolve(ctx.baseDir, "data", "logs");
  ctx.logger.info(`[log end] 日志目录: ${logDir}`);

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    ctx.logger.info("[log end] 已创建日志目录");
  }

  const filePath = path.resolve(logDir, `${log.logname}.txt`);
  fs.writeFileSync(filePath, content, "utf-8");
  ctx.logger.info(`[log end] 文件已写入: ${filePath}`);

  // 归档
  const archiveDir = path.resolve(logDir, "archive");
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  const archiveStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.resolve(
    archiveDir,
    `${log.logname}_${archiveStamp}.txt`,
  );
  fs.copyFileSync(filePath, archivePath);
  ctx.logger.info(`[log end] 已归档到: ${archivePath}`);

  // 恢复 session.send（避免导出文件的行为被记录）
  if ((session as any)._originalSend) {
    session.send = (session as any)._originalSend;
    delete (session as any)._originalSend;
    ctx.logger.info("[log end] 已恢复 session.send");
  }

  // 发送文件
  ctx.logger.info("[log end] 开始发送文件");
  try {
    await session.send(h.file(filePath));
    ctx.logger.info("[log end] 文件发送成功");
  } catch (e) {
    ctx.logger.warn("[log end] 文件发送失败，回退到文本", e);
    if (content.length < 2000) {
      await session.send(content);
    } else {
      await session.send(
        `日志「${log.logname}」已结束，共 ${lines.length} 条记录\n` +
          `文件已保存到：${filePath}\n` +
          "（内容过长无法发送，请从服务器查看文件）",
      );
    }
  }

  // 清理数据库
  ctx.logger.info("[log end] 开始清理数据库");
  try {
    const removed = await ctx.database.remove("dicelogline", (row) =>
      $.and($.eq(row.groupid, groupId), $.eq(row.logname, log.logname)),
    );
    await ctx.database.remove("dicelog", (row) => $.eq(row.id, log.id));
    ctx.logger.info(
      `[log end] 数据库清理完成，删除了 ${lines.length} 条 dicelogline 记录`,
    );
  } catch (e) {
    ctx.logger.warn("[log end] 清理数据库失败", e);
  }

  ctx.logger.info("[log end] 全部完成");
  return;
}

// ==================== 辅助函数 ====================

/** 把 koishi 消息内容转为纯文本 */
function contentToString(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((el) => {
        if (typeof el === "string") return el;
        if (el && typeof el === "object") {
          if (el.type === "text") return el.attrs?.content || "";
          if (el.type === "at")
            return `@${el.attrs?.name || el.attrs?.id || ""}`;
          if (el.type === "image" || el.type === "img") return "[图片]";
          if (el.type === "file")
            return `[文件:${el.attrs?.name || el.attrs?.filename || ""}]`;
          if (el.type === "audio") return "[语音]";
          if (el.type === "video") return "[视频]";
          if (el.type === "quote") return "";
          if (el.children) return contentToString(el.children);
          return "";
        }
        return String(el || "");
      })
      .join("");
  }
  if (content && typeof content === "object") {
    if (content.type === "text") return content.attrs?.content || "";
    if (content.type === "image" || content.type === "img") return "[图片]";
    if (content.type === "file") return `[文件:${content.attrs?.name || ""}]`;
    if (content.children) return contentToString(content.children);
  }
  return String(content || "");
}

/** 格式化日志内容为文本（兼容海豹染色器 QQ 格式） */
function formatLogContent(lines: any[]): string {
  return lines
    .map((line) => {
      const name = line.username || "未知";
      const uid = line.userid ? `(${line.userid})` : "";
      const time = formatFullDateTime(line.timestamp);
      return `${name}${uid} ${time}\n${line.content}`;
    })
    .join("\n\n");
}

/** 时间戳格式化为 HH:MM:SS */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** 时间戳格式化为 年/月/日 时:分:秒 */
function formatFullDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${MM}/${dd} ${formatTime(timestamp)}`;
}
