import { Context, $, Session } from "koishi";
import { Config } from "../config";
import { Property_Dict, PRO_CON_Dict, Cook_Dict } from "../utiles/dict";
import { ensureEnabled } from "./commandGugu";

// ==================== 二元骰结果配置 ====================

type OutcomeKey = "hope" | "despair" | "critical";

interface ResourceUpdate {
  target: "player" | "gm";
  field: "hope" | "fear" | "stress";
  direction: 1 | -1;
  cap: number;
}

interface ChangeDisplay {
  label: string;
  target: "player" | "gm";
  field: "hope" | "fear" | "stress";
  direction: 1 | -1;
  cap: number;
  capLabel: string;
  defaultValue: number;
}

interface OutcomeSpec {
  label: string;
  quoteKey: "hopeResultText" | "despairResultText" | "wonderfulResultText";
  showTotal: boolean;
  updates: ResourceUpdate[];
  changeDisplays: ChangeDisplay[];
}

// 三种结果的差异集中在此处：标题、寄语来源、资源更新、变化行
const OUTCOMES: Record<OutcomeKey, OutcomeSpec> = {
  hope: {
    label: "希望结果",
    quoteKey: "hopeResultText",
    showTotal: true,
    updates: [{ target: "player", field: "hope", direction: 1, cap: 6 }],
    changeDisplays: [
      {
        label: "[希望值变化]",
        target: "player",
        field: "hope",
        direction: 1,
        cap: 6,
        capLabel: "6(已满)",
        defaultValue: 2,
      },
    ],
  },
  despair: {
    label: "恐惧结果",
    quoteKey: "despairResultText",
    showTotal: true,
    updates: [{ target: "gm", field: "fear", direction: 1, cap: 12 }],
    changeDisplays: [
      {
        label: "[恐惧点变化]",
        target: "gm",
        field: "fear",
        direction: 1,
        cap: 12,
        capLabel: "12(已满)",
        defaultValue: 0,
      },
    ],
  },
  critical: {
    label: "关键成功！",
    quoteKey: "wonderfulResultText",
    showTotal: false,
    updates: [
      { target: "player", field: "hope", direction: 1, cap: 6 },
      { target: "player", field: "stress", direction: -1, cap: 0 },
    ],
    changeDisplays: [
      {
        label: "[希望值变化]",
        target: "player",
        field: "hope",
        direction: 1,
        cap: 6,
        capLabel: "6(已满)",
        defaultValue: 2,
      },
      {
        label: "[压力值变化]",
        target: "player",
        field: "stress",
        direction: -1,
        cap: 0,
        capLabel: "0",
        defaultValue: 0,
      },
    ],
  },
};

// ==================== 命令注册 ====================

export function commandDice(ctx: Context, config: Config) {
  ctx.command("r [values] 掷骰子").action(async ({ session }, values) => {
    if (!session) return "无法获取用户信息。";
    if (!(await ensureEnabled(ctx, session))) return;

    if (!values) {
      const roll = Math.floor(Math.random() * 6) + 1;
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n${roll}`,
      );
      return;
    }
    nomalRollResult(values, session);
  });

  ctx.command("cook 烹菜").action(async ({ session }) => {
    if (!session) return "无法获取用户信息。";
    if (!(await ensureEnabled(ctx, session))) return;
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

  // 前置掷骰中间件（.ddr 反应掷骰，不修改资源）
  // 注意：匹配到 .ddr 后必须直接 return 吞掉事件，否则下方 .dd 中间件会
  // 把 .ddr 当作 .dd 再处理一次（dd 是 ddr 的前缀），导致重复掷骰+错误改库
  ctx.middleware(async (session, next) => {
    if (!session) return "无法获取用户信息。";
    const prefixMatch = session.content.match(/^([。\.]ddr)/i);
    if (prefixMatch) {
      if (!(await ensureEnabled(ctx, session))) return; // 咕咕静默
      const [hope, despair] = rollTwoDice();
      const result = hope + despair;
      const rest = session.content
        .slice(prefixMatch[0].length)
        .trimStart()
        .replace(/\s+/g, "");
      rollResult(rest, despair, hope, session, ctx, result, config, true);
      return; // 已处理，不再向下传递
    }
    return next();
  }, true);

  // 掷骰中间件（.dd 二元骰 / .r 普通骰）
  ctx.middleware(async (session, next) => {
    if (!session) return "无法获取用户信息。";
    const prefixMatch = session.content.match(/^([。\.]dd)/i);
    const prefixMatchR = session.content.match(/^([。\.]r)/i);
    if (prefixMatch) {
      if (!(await ensureEnabled(ctx, session))) return; // 咕咕静默
      const [hope, despair] = rollTwoDice();
      const result = hope + despair;
      const rest = session.content
        .slice(prefixMatch[0].length)
        .trimStart()
        .replace(/\s+/g, "");
      rollResult(rest, despair, hope, session, ctx, result, config);
    }
    if (prefixMatchR) {
      if (!(await ensureEnabled(ctx, session))) return; // 咕咕静默
      const rest = session.content
        .slice(prefixMatchR[0].length)
        .trimStart()
        .replace(/\s+/g, "");
      nomalRollResult(rest, session);
    }
    return next();
  });
}

// ==================== 二元骰核心 ====================

/** 二元骰：希望骰与恐惧骰（均为 1d12） */
function rollTwoDice(): number[] {
  const hope = Math.floor(Math.random() * 12) + 1;
  const despair = Math.floor(Math.random() * 12) + 1;
  return [hope, despair];
}

/** 从配置中随机取一句命运寄语 */
function pickQuote(config: Config, key: OutcomeSpec["quoteKey"]): string {
  const arr = config[key];
  if (!arr || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 应用结果对应的资源更新到数据库 */
async function applyOutcomeUpdates(
  ctx: Context,
  spec: OutcomeSpec,
  user: any,
  groupId: string,
): Promise<void> {
  const playerUpdates = spec.updates.filter((u) => u.target === "player");
  const gmUpdates = spec.updates.filter((u) => u.target === "gm");

  if (playerUpdates.length > 0) {
    await ctx.database.set(
      "playercharacter",
      { userid: user.id, useable: true, groupid: groupId },
      (row) => buildUpdatePatch(row, playerUpdates),
    );
  }
  if (gmUpdates.length > 0) {
    await ctx.database.set(
      "playercharacter",
      { rolename: "GM", useable: true, groupid: groupId },
      (row) => buildUpdatePatch(row, gmUpdates),
    );
  }
}

function buildUpdatePatch(row: any, updates: ResourceUpdate[]): any {
  const patch: Record<string, any> = {};
  for (const u of updates) {
    const next =
      u.direction > 0
        ? $.min([$.add(row[u.field].value, 1), u.cap])
        : $.max([$.subtract(row[u.field].value, 1), u.cap]);
    patch[`${u.field}.value`] = next;
  }
  return patch;
}

/** 格式化 "[希望值变化]: X->Y" 类提示行（无角色时按默认值模拟） */
function formatChangeLines(
  spec: OutcomeSpec,
  character: any[],
  gmCharacter: any[],
): string {
  return spec.changeDisplays
    .map((d) => {
      const target = d.target === "player" ? character : gmCharacter;
      if (target.length === 0) {
        return `${d.label}: ${d.defaultValue}->${d.defaultValue + d.direction}`;
      }
      const currentValue = target[0][d.field].value;
      const isCapped =
        d.direction > 0 ? currentValue >= d.cap : currentValue <= d.cap;
      if (isCapped) return `${d.label}: ${d.capLabel}`;
      return `${d.label}: ${currentValue}->${currentValue + d.direction}`;
    })
    .join(" ");
}

/**
 * 二元骰结果方程
 * 统一处理 hope/despair/critical 三种结果 × 是否反应掷骰 × 是否带调整值
 */
async function rollResult(
  rest: string,
  despair: number,
  hope: number,
  session: Session,
  ctx: Context,
  result: number,
  config: Config,
  isPrepend?: boolean,
) {
  const user = session.event.user;
  const groupId = session.guildId;

  const character = await ctx.database
    .select("playercharacter")
    .where((row) => $.eq(row.userid, session.event.user.id))
    .where((row) => $.eq(row.groupid, session.guildId))
    .where((row) => $.eq(row.useable, true))
    .execute();

  const gmCharacter = await ctx.database
    .select("playercharacter")
    .where((row) => $.eq(row.rolename, "GM"))
    .where((row) => $.eq(row.groupid, session.guildId))
    .where((row) => $.eq(row.useable, true))
    .execute();

  // 1. 判定结果类型
  const outcomeKey: OutcomeKey =
    hope > despair ? "hope" : hope < despair ? "despair" : "critical";
  const spec = OUTCOMES[outcomeKey];

  // 2. 解析调整值（如果有）
  let adjustments: string[] = [];
  let total = 0;
  if (rest !== "") {
    const parsed = parseAdjustments(rest, character, session, ctx);
    if (!parsed) return;
    adjustments = parsed.adjustments;
    total = parsed.total;
  }

  // 3. 应用数据库资源更新（反应掷骰跳过）
  if (!isPrepend) {
    await applyOutcomeUpdates(ctx, spec, user, groupId);
  }

  // 4. 构建并发送消息
  const adjustStr =
    adjustments.length > 0 ? `\n调整值: ${adjustments.join(",")}` : "";
  const changeStr = isPrepend
    ? ""
    : formatChangeLines(spec, character, gmCharacter);
  const changeLine = changeStr ? `\n${changeStr}` : "";
  const prependLine = isPrepend ? "\n[反应掷骰]" : "";
  const totalLine = spec.showTotal
    ? `      合计 ${result + total}         ${spec.label}`
    : `            ${spec.label}`;

  session.send(
    `${session.event.user.name} 掷出了它的命运，结果会是什么呢${adjustStr}\n` +
      `--------------------------------------------\n` +
      `希望骰 ${hope}       与        恐惧骰 ${despair}\n` +
      `-------------------------------------------\n` +
      `${totalLine}${changeLine}${prependLine}\n` +
      `[命运的寄语]: ${pickQuote(config, spec.quoteKey)}      `,
  );
}

/** 解析二元骰后的调整值表达式（数字/骰子/属性名/优劣势/经验标记） */
function parseAdjustments(
  rest: string,
  character: any[],
  session: Session,
  ctx: Context,
): { adjustments: string[]; total: number } | null {
  const termRegex = /([+-]?)\s*(?:(\d*)d(\d+)|([^+-]+?))(?=\s*[+-]|$)/g;
  const terms = Array.from(rest.matchAll(termRegex));
  // 检查是否完整匹配（防止中间有非法字符）
  const reconstructed = terms.map((t) => t[0]).join("");
  if (reconstructed.replace(/\s+/g, "") !== rest.replace(/\s+/g, "")) {
    ctx.logger.error(`表达式包含非法内容："${rest}"`);
    return null;
  }

  let total = 0;
  let i = 0;
  const adjustments: string[] = [];

  while (i < terms.length) {
    const str = terms[i][0].replace(/\s+/g, ""); // 去掉内部空格
    const matchResult = diceMatch(str);

    // 数字 / 骰子项
    if (matchResult) {
      const [op, value] = matchResult;
      adjustments.push(op === "+" ? `+${value}` : `-${value}`);
      total += op === "+" ? value : -value;
      i++;
      continue;
    }

    // 名称项（属性 / 优劣势 / 经验标记）
    const nameMatch = str.match(/^([+-]?)(.*)$/);
    const pureName = nameMatch[2].trim();

    if (Property_Dict[pureName]) {
      if (character.length === 0) {
        session.send(`舞台上还没有这位角色"${pureName}"的属性值`);
        return null;
      }
      const propValue = Number(character[0].property[Property_Dict[pureName]]);
      adjustments.push(
        propValue > 0 ? `+${propValue}[${pureName}]` : `${propValue}[${pureName}]`,
      );
      total += propValue;
      i++;
      continue;
    }

    if (PRO_CON_Dict[pureName] && diceMatch(PRO_CON_Dict[pureName])) {
      const [opD, valueD] = diceMatch(PRO_CON_Dict[pureName]);
      adjustments.push(opD === "+" ? `+${valueD}` : `-${valueD}`);
      total += opD === "+" ? valueD : -valueD;
      i++;
      continue;
    }

    if (!character || character.length === 0) {
      ctx.logger.error(`无法解析项，且未找到角色信息："${str}"`);
      session.send(`无法解析项，且未找到角色信息："${str}"`);
      return null;
    }

    const experienceArray = JSON.parse(character[0].experience);
    const experienceObject = experienceArray.reduce(
      (acc: any, item: any) => {
        acc[item.key] = item.value;
        return acc;
      },
      {},
    );
    if (experienceObject[pureName]) {
      const value = Number(experienceObject[pureName]);
      adjustments.push(`+${value}[${pureName}]`);
      total += value;
      i++;
      continue;
    }

    ctx.logger.error(`无法解析项: "${str}"`);
    session.send(`无法解析项："${str}"`);
    return null; // 修复：原代码此处未 return/i++，会导致死循环
  }

  return { adjustments, total };
}

// ==================== 普通骰 / 表达式解析 ====================

/** 解析骰子表达式
 * @param term 骰子表达式
 * @returns 解析结果
 */
function parseTerm(term: string): {
  type: "dice" | "number";
  count?: number;
  faces?: number;
  value?: number;
} {
  const diceMatch = term.match(/^([1-9]\d*)?d([1-9]\d*)$/i);
  if (diceMatch) {
    const countStr = diceMatch[1]; // 可能是 undefined 或字符串如 "2"
    const facesStr = diceMatch[2];
    const count = countStr ? parseInt(countStr, 10) : 1; // 【核心】省略时默认为 1
    const faces = parseInt(facesStr, 10);
    return { type: "dice", count, faces };
  }

  const numMatch = term.match(/^[1-9]\d*$/);
  if (numMatch) {
    return { type: "number", value: parseInt(term, 10) };
  }

  throw new Error(`无效项: ${term}`);
}

/** 普通掷骰子结果 */
function nomalRollResult(values: string, session: Session) {
  const extraTypeStr =
    /^[+-]?(?:[1-9]\d*d[1-9]\d*|d[1-9]\d*|[1-9]\d*)(?:[+-](?:[1-9]\d*d[1-9]\d*|d[1-9]\d*|[1-9]\d*))*$/;
  if (!extraTypeStr.test(values)) return "骰子类型格式错误。";

  const termMatches = values.match(
    /[+-]?(?:[1-9]\d*d[1-9]\d*|d[1-9]\d*|[1-9]\d*)/g,
  );
  if (!termMatches) return "骰子类型格式错误.";

  let terms = termMatches;
  if (!/^[+-]/.test(values)) {
    terms = ["+" + termMatches[0], ...termMatches.slice(1)];
  }

  let total = 0;
  const details: string[] = [];

  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const content =
      term.startsWith("+") || term.startsWith("-") ? term.slice(1) : term;

    const parsed = parseTerm(content);
    if (parsed.type === "dice") {
      let sum = 0;
      const rolls: number[] = [];
      for (let i = 0; i < parsed.count!; i++) {
        const roll = Math.floor(Math.random() * parsed.faces!) + 1;
        rolls.push(roll);
        sum += roll;
      }
      total += sign * sum;
      const rollStr = `(${rolls.join("+")})`;
      details.push((sign === -1 ? "-" : "+") + rollStr);
    } else {
      const value = parsed.value!;
      total += sign * value;
      details.push((sign === -1 ? "-" : "+") + value.toString());
    }
  }

  // 优化显示：去掉开头的 '+'
  let detailStr = details.join("");
  if (detailStr.startsWith("+")) {
    detailStr = detailStr.slice(1);
  }

  session.send(
    `${session.event.user.name} <br/> 掷出了 <hr/> ${detailStr} = ${total}。<br/>`,
  );
}

/** 正则匹配为骰子时的方法
 * @param str 骰子表达式（如 "+1d6" / "-2" / "1d6" / "2"）
 * @returns [运算符, 掷出的数值] 或 null（非数字/骰子项时）
 * @note 符号可选：缺省视为 "+"，与 parseAdjustments 的 termRegex 保持一致
 */
function diceMatch(str: string): [string, number] | null {
  const match = str.match(/^([+-]?)((\d*)d(\d+)|(\d+))$/);
  if (match) {
    const [, op, , diceCount, faces, constant] = match;
    const sign: string = op === "-" ? "-" : "+";
    let value: number;

    if (faces !== undefined) {
      // 骰子项
      const count = diceCount === "" ? 1 : Number(diceCount);
      const f = Number(faces);
      if (count < 1 || f < 1) {
        throw new Error(`骰子参数无效：${str}`);
      }
      value = Array(count)
        .fill(0)
        .reduce((sum) => sum + Math.floor(Math.random() * f) + 1, 0);
    } else {
      // 常数项
      value = Number(constant);
    }
    return [sign, value];
  } else {
    return null;
  }
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
