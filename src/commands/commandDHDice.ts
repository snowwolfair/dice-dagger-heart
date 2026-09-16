import { Context } from "koishi";
import { Cook_Dict } from "../utiles/dict";
import { ensureRule } from "./commandRule";
import { listenCommand } from "../utiles/listenCommand";

// ==================== DH 专属：烹饪机制 ====================

/** 注册 DH 烹饪指令（中间件）。二元骰（.dd/.ddr）已由基底的 registerDiceSystem 接管。 */
export function registerDHDice(ctx: Context) {
  listenCommand(ctx, "cook", async (session) => {
    if (!(await ensureRule(ctx, session, "DH"))) return;

    await session.send(
      `大锅已经支起来了，请往里面投放食材吧\n例： 1甜味+2酸味+4苦味`,
    );

    let cook = await session.prompt();
    if (!cook) return "未投入任何食材,锅烧糊啦！";

    let pool: { value: number; max: number; flavor: string }[] = [];
    try {
      pool = parseFlavor(cook);
    } catch (error) {
      ctx.logger.error(error.message);
      return error.message;
    }

    let totalScore = 0;
    let count = 0;

    // 核心交互循环：只要锅里还有食材，就不断进行
    mainLoop: while (pool.length > 1) {
      count++;

      // 1. 掷出所有骰子
      for (const die of pool) {
        die.value = Math.floor(Math.random() * die.max) + 1;
      }

      // 2. 生成 terms 字符串: [甜味：4]，[苦味：6]
      const terms = pool.map((d) => `[${d.flavor}：${d.value}]`).join("，");

      // 3. 按点数分组
      const countMap = new Map<
        number,
        { value: number; max: number; flavor: string }[]
      >();
      for (const die of pool) {
        if (!countMap.has(die.value)) countMap.set(die.value, []);
        countMap.get(die.value)!.push(die);
      }

      // 4. 找出所有出现次数 > 1 的点数
      const matchingEntries = Array.from(countMap.entries()).filter(
        ([_, diceList]) => diceList.length > 1,
      );

      let message = "";
      if (matchingEntries.length > 0) {
        // 【情况A】有相同点数：自动消除并直接进入下一轮
        const listLines: string[] = [];
        let roundScore = 0;

        for (const [num, diceList] of matchingEntries) {
          const groupItems = diceList
            .map((die) => `[${die.flavor}:${num}]`)
            .join(",");
          roundScore += num;
          listLines.push(`${groupItems}-->得分：${num}`);

          for (const die of diceList) {
            const index = pool.indexOf(die);
            if (index !== -1) pool.splice(index, 1);
          }
        }

        totalScore += roundScore;
        message = `大锅开始搅动......进行第${count}轮烹饪\n${terms}\n-----------\n 相同的点数是\n${listLines.join("\n")}\n-----------\n当前分数为：${totalScore}\n当前锅中还剩食材：${getRemainingIngredients(pool)}`;

        await session.sendQueued(message, 3000);
        if (pool.length === 0) break;
        continue; // 直接进入下一轮
      }

      // 【情况B】无相同点数：等待用户 rm 移除一颗
      message = `大锅开始搅动......进行第${count}轮烹饪\n${terms}\n-----------\n 没有相同的点数\n-----------\n当前分数为：${totalScore}\n当前锅中还剩食材：${getRemainingIngredients(pool)}\n-----------\n输入rm 味道来移除一颗骰子以进行下一次烹饪\n例：rm 甜味`;
      await session.sendQueued(message, 3000);
      if (pool.length <= 2) break;

      const dispose = session.middleware(({ content }, next) => {
        const trimmed = content.trim();
        // 只有严格符合 "rm xxx" 格式的消息才放行
        if (/^rm\s+.+$/i.test(trimmed)) {
          return next();
        }
      });

      try {
        while (true) {
          const rmInput = await session.prompt();
          if (!rmInput) {
            await session.send("等待超时，锅烧糊啦！");
            break mainLoop;
          }

          const rmMatch = rmInput.trim().match(/^rm\s+(.+)$/i);
          if (!rmMatch) {
            await session.send("指令格式错误，请输入类似 'rm 甜味' 的指令");
            continue;
          }

          const flavorToRemove = rmMatch[1];
          const index = pool.findIndex((d) => d.flavor === flavorToRemove);
          if (index === -1) {
            await session.send(
              `锅里没有找到 [${flavorToRemove}]，请重新输入！`,
            );
            continue;
          }

          pool.splice(index, 1);
          await session.sendQueued(
            `成功从锅中捞出了一颗 [${flavorToRemove}]，当前锅里剩余 ${pool.length} 份食材。`,
            2000,
          );
          break;
        }
      } finally {
        dispose();
      }
    }

    return `烹饪结束！锅里已经空了，本次烹饪最终总分为：${totalScore}`;
  });
}

// ==================== 烹饪机制辅助 ====================

/** 解析烹饪输入 "1甜味+2酸味" 为骰子池 */
function parseFlavor(
  notation: string,
): { value: number; max: number; flavor: string }[] {
  if (!notation || typeof notation !== "string")
    throw new Error("无效的输入格式");
  const cleanStr = notation.replace(/\s+/g, "");
  const pool: { value: number; max: number; flavor: string }[] = [];

  const parts = cleanStr.split("+");
  for (const part of parts) {
    const match = part.match(/^(\d+)(.+)$/);
    if (!match) throw new Error(`无法解析的食材格式: ${part}`);

    const [, countStr, flavor] = match;
    const count = parseInt(countStr, 10);
    const diceType = Cook_Dict[flavor];
    if (!diceType) throw new Error(`未知的味道类型: ${flavor}`);

    const sides = parseInt(diceType.substring(1), 10);
    for (let i = 0; i < count; i++) {
      pool.push({ value: 0, max: sides, flavor });
    }
  }
  return pool;
}

/** 按味道汇总剩余食材，如 "[2甜味][1苦味]" */
function getRemainingIngredients(pool: { flavor: string }[]): string {
  if (pool.length === 0) return "无";

  const flavorCountMap = new Map<string, number>();
  for (const die of pool) {
    flavorCountMap.set(die.flavor, (flavorCountMap.get(die.flavor) || 0) + 1);
  }

  return Array.from(flavorCountMap.entries())
    .map(([flavor, count]) => `[${count}${flavor}]`)
    .join("");
}
