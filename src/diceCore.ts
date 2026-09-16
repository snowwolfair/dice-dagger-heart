import { Context, $, Session } from "koishi";
import {
  DiceSystemConfig,
  OutcomeConfig,
  ResourceChange,
} from "./types";
import { DEFAULT_RULE_KEY } from "./utiles/rules";

// ==================== 二元骰系统注册 ====================

/** 注册二元骰系统：自动注册 .ddr（前置）/.dd 中间件
 * 每个中间件内部先做规则路由（currentRule === config.ruleKey 才处理，
 * 否则 next() 放行给其他规则的中间件），再做 gugu 守卫 */
export function registerDiceSystem(
  ctx: Context,
  config: DiceSystemConfig,
): void {
  // .ddr 前置中间件（反应掷骰，不修改资源）
  // 注意：匹配到 .ddr 后必须直接 return 吞掉事件，否则后续 .dd 中间件会
  // 把 .ddr 当作 .dd 再处理一次（dd 是 ddr 的前缀），导致重复掷骰
  ctx.middleware(async (session, next) => {
    if (!session) return next();
    const prefixMatch = session.content?.match(/^([。\.]ddr)/i);
    if (!prefixMatch) return next();

    // 规则路由：只有当前群规则 === config.ruleKey 才处理
    if (!(await isRuleMatched(ctx, session, config.ruleKey))) return next();

    const [positive, negative] = await doRollTwoDice(ctx, session, config);
    const total = positive + negative;
    const rest = session.content
      .slice(prefixMatch[0].length)
      .trimStart()
      .replace(/\s+/g, "");
    await rollResult(rest, negative, positive, session, ctx, total, config, true);
    return; // 已处理，不再向下传递
  }, true);

  // .dd 中间件（标准二元骰）
  ctx.middleware(async (session, next) => {
    if (!session) return next();
    const prefixMatch = session.content?.match(/^([。\.]dd)/i);
    if (!prefixMatch) return next();

    // 规则路由
    if (!(await isRuleMatched(ctx, session, config.ruleKey))) return next();

    const [positive, negative] = await doRollTwoDice(ctx, session, config);
    const total = positive + negative;
    const rest = session.content
      .slice(prefixMatch[0].length)
      .trimStart()
      .replace(/\s+/g, "");
    await rollResult(rest, negative, positive, session, ctx, total, config);
    return next();
  });
}

/** 执行二元骰掷骰：优先 customRollDice 钩子，否则走默认 rollTwoDice */
async function doRollTwoDice(
  ctx: Context,
  session: Session,
  config: DiceSystemConfig,
): Promise<[number, number]> {
  if (config.customRollDice) {
    const custom = await config.customRollDice(ctx, session, config);
    if (custom) return custom;
  }
  return rollTwoDice(config.diceSides) as [number, number];
}

/** 规则路由守卫：当前群规则 === ruleKey 时返回 true（含 gugu 检查） */
async function isRuleMatched(
  ctx: Context,
  session: Session,
  ruleKey: string,
): Promise<boolean> {
  const groupId = session.guildId;
  if (!groupId) {
    const matched = ruleKey === DEFAULT_RULE_KEY;
    ctx.logger.info(`[isRuleMatched] 私聊, ruleKey=${ruleKey}, matched=${matched}`);
    return matched;
  }

  // 一次查询 groupstate，同时判断 gugu 开关与规则
  const rows = await ctx.database
    .select("groupstate")
    .where((row) => $.eq(row.groupid, groupId))
    .execute();
  if (rows.length === 0) {
    const matched = ruleKey === DEFAULT_RULE_KEY;
    ctx.logger.info(`[isRuleMatched] 未注册群 ${groupId}, ruleKey=${ruleKey}, matched=${matched}`);
    return matched;
  }

  if (!rows[0].enabled) {
    ctx.logger.info(`[isRuleMatched] 群 ${groupId} gugu关闭, ruleKey=${ruleKey}, matched=false`);
    return false;
  }
  const matched = rows[0].rulename === ruleKey;
  ctx.logger.info(`[isRuleMatched] 群 ${groupId}, 当前规则=${rows[0].rulename}, ruleKey=${ruleKey}, matched=${matched}`);
  return matched;
}

// ==================== 二元骰核心（参数化） ====================

/** 掷出二元骰：[正面骰, 负面骰] */
function rollTwoDice(sides: number): number[] {
  const positive = Math.floor(Math.random() * sides) + 1;
  const negative = Math.floor(Math.random() * sides) + 1;
  return [positive, negative];
}

/** 从结果配置的寄语池中随机取一句 */
function pickQuote(outcome: OutcomeConfig): string {
  if (!outcome.quotes || outcome.quotes.length === 0) return "";
  return outcome.quotes[Math.floor(Math.random() * outcome.quotes.length)];
}

/** 应用结果的标准资源变化到数据库，然后执行自定义更新钩子 */
async function applyOutcomeUpdates(
  ctx: Context,
  session: Session,
  outcome: OutcomeConfig,
  config: DiceSystemConfig,
  rollData: { positive: number; negative: number; total: number },
  character: any[],
  gmCharacter: any[],
): Promise<void> {
  const groupId = session.guildId;
  const userId = session.event.user?.id;

  // 1. 标准资源变化
  const playerChanges = outcome.resources.filter((c) => c.target === "player");
  const gmChanges = outcome.resources.filter((c) => c.target === "gm");

  if (playerChanges.length > 0 && userId && groupId) {
    await ctx.database.set(
      config.characterTable as any,
      { userid: userId, useable: true, groupid: groupId },
      (row) => buildUpdatePatch(row, playerChanges),
    );
  }
  if (gmChanges.length > 0 && groupId) {
    await ctx.database.set(
      config.characterTable as any,
      { rolename: config.gmRoleName, useable: true, groupid: groupId },
      (row) => buildUpdatePatch(row, gmChanges),
    );
  }

  // 2. 自定义更新钩子
  if (outcome.customUpdate) {
    await outcome.customUpdate({
      ctx,
      session,
      rollResult: rollData,
      character,
      gmCharacter,
    });
  }
}

/** 构建标准资源变化的数据库更新补丁 */
function buildUpdatePatch(row: any, changes: ResourceChange[]): any {
  const patch: Record<string, any> = {};
  for (const c of changes) {
    const next =
      c.direction > 0
        ? $.min([$.add(row[c.field].value, 1), c.cap])
        : $.max([$.subtract(row[c.field].value, 1), c.cap]);
    patch[`${c.field}.value`] = next;
  }
  return patch;
}

/** 格式化变化行：标准显示 + 自定义显示钩子 */
async function formatChangeLines(
  outcome: OutcomeConfig,
  character: any[],
  gmCharacter: any[],
  rollData: { positive: number; negative: number; total: number },
  session: Session,
  ctx: Context,
): Promise<string> {
  const lines: string[] = [];

  // 1. 标准显示
  for (const c of outcome.resources) {
    const target = c.target === "player" ? character : gmCharacter;
    if (target.length === 0) {
      lines.push(
        `${c.displayLabel}: ${c.defaultValue}->${c.defaultValue + c.direction}`,
      );
      continue;
    }
    const currentValue = target[0][c.field].value;
    const isCapped =
      c.direction > 0 ? currentValue >= c.cap : currentValue <= c.cap;
    if (isCapped) {
      lines.push(`${c.displayLabel}: ${c.capLabel}`);
    } else {
      lines.push(
        `${c.displayLabel}: ${currentValue}->${currentValue + c.direction}`,
      );
    }
  }

  // 2. 自定义显示钩子
  if (outcome.customDisplay) {
    const customLine = await outcome.customDisplay({
      ctx,
      session,
      rollResult: rollData,
      character,
      gmCharacter,
    });
    if (customLine) lines.push(customLine);
  }

  return lines.join(" ");
}

/** 二元骰结果统一处理：判定类型 → 解析调整值 → 更新资源 → 发送消息 */
async function rollResult(
  rest: string,
  negative: number,
  positive: number,
  session: Session,
  ctx: Context,
  total: number,
  config: DiceSystemConfig,
  isPrepend?: boolean,
): Promise<void> {
  const userId = session.event.user?.id;
  const groupId = session.guildId;
  const rollData = { positive, negative, total };

  // 查询当前玩家角色与 GM 角色
  const character =
    userId && groupId
      ? await ctx.database
          .select(config.characterTable as any)
          .where((row) => $.eq(row.userid, userId))
          .where((row) => $.eq(row.groupid, groupId))
          .where((row) => $.eq(row.useable, true))
          .execute()
      : [];

  const gmCharacter = groupId
    ? await ctx.database
        .select(config.characterTable as any)
        .where((row) => $.eq(row.rolename, config.gmRoleName))
        .where((row) => $.eq(row.groupid, groupId))
        .where((row) => $.eq(row.useable, true))
        .execute()
    : [];

  // 1. 判定结果类型
  const outcomeKey: "positive" | "negative" | "critical" =
    positive > negative
      ? "positive"
      : positive < negative
        ? "negative"
        : "critical";
  const outcome = config.outcomes[outcomeKey];

  // 2. 解析调整值（如果有）
  let adjustments: string[] = [];
  let adjustTotal = 0;
  if (rest !== "") {
    const parsed = await parseAdjustments(rest, character, session, ctx, config);
    if (!parsed) return;
    adjustments = parsed.adjustments;
    adjustTotal = parsed.total;
  }

  // 3. 应用数据库资源更新（反应掷骰跳过）
  if (!isPrepend) {
    await applyOutcomeUpdates(
      ctx,
      session,
      outcome,
      config,
      rollData,
      character,
      gmCharacter,
    );

    // 负面结果：GM 资源变化后同步更新其群名片（onebot 平台）
    if (
      outcomeKey === "negative" &&
      gmCharacter.length > 0 &&
      session.platform === "onebot"
    ) {
      const updatedGm = await ctx.database
        .select(config.characterTable as any)
        .where((row) => $.eq(row.rolename, config.gmRoleName))
        .where((row) => $.eq(row.groupid, groupId!))
        .where((row) => $.eq(row.useable, true))
        .execute();
      if (updatedGm.length > 0) {
        await session.onebot.setGroupCard(
          groupId!,
          updatedGm[0].userid,
          config.buildCardName(updatedGm[0]),
        );
      }
    }
  }

  // 4. 构建并发送消息
  const adjustStr =
    adjustments.length > 0 ? `\n调整值: ${adjustments.join(",")}` : "";
  const changeStr = isPrepend
    ? ""
    : await formatChangeLines(
        outcome,
        character,
        gmCharacter,
        rollData,
        session,
        ctx,
      );
  const changeLine = changeStr ? `\n${changeStr}` : "";
  const prependLine = isPrepend ? "\n[反应掷骰]" : "";
  const totalLine = outcome.showTotal
    ? `      合计 ${total + adjustTotal}         ${outcome.label}`
    : `            ${outcome.label}`;

  await session.send(
    `${session.event.user.name} 掷出了它的命运，结果会是什么呢${adjustStr}\n` +
      `--------------------------------------------\n` +
      `${config.positiveDieName} ${positive}       与        ${config.negativeDieName} ${negative}\n` +
      `-------------------------------------------\n` +
      `${totalLine}${changeLine}${prependLine}\n` +
      `[命运的寄语]: ${pickQuote(outcome)}      `,
  );
}

// ==================== 调整值解析（参数化） ====================

/** 解析二元骰后的调整值表达式（数字/骰子/属性名/优劣势/经验标记） */
async function parseAdjustments(
  rest: string,
  character: any[],
  session: Session,
  ctx: Context,
  config: DiceSystemConfig,
): Promise<{ adjustments: string[]; total: number } | null> {
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

    if (config.propertyDict[pureName]) {
      if (character.length === 0) {
        await session.send(`舞台上还没有这位角色"${pureName}"的属性值`);
        return null;
      }
      const propValue = Number(
        character[0].property[config.propertyDict[pureName]],
      );
      adjustments.push(
        propValue > 0
          ? `+${propValue}[${pureName}]`
          : `${propValue}[${pureName}]`,
      );
      total += propValue;
      i++;
      continue;
    }

    if (config.proConDict && config.proConDict[pureName]) {
      const [opD, valueD] = diceMatch(config.proConDict[pureName])!;
      adjustments.push(opD === "+" ? `+${valueD}` : `-${valueD}`);
      total += opD === "+" ? valueD : -valueD;
      i++;
      continue;
    }

    if (!character || character.length === 0) {
      ctx.logger.error(`无法解析项，且未找到角色信息："${str}"`);
      await session.send(`无法解析项，且未找到角色信息："${str}"`);
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
    await session.send(`无法解析项："${str}"`);
    return null;
  }

  return { adjustments, total };
}

/** 匹配骰子表达式：返回 [运算符, 掷出的数值] 或 null */
function diceMatch(str: string): [string, number] | null {
  const match = str.match(/^([+-]?)((\d*)d(\d+)|(\d+))$/);
  if (match) {
    const [, op, , diceCount, faces, constant] = match;
    const sign: string = op === "-" ? "-" : "+";
    let value: number;

    if (faces !== undefined) {
      const count = diceCount === "" ? 1 : Number(diceCount);
      const f = Number(faces);
      if (count < 1 || f < 1) {
        throw new Error(`骰子参数无效：${str}`);
      }
      value = Array(count)
        .fill(0)
        .reduce((sum) => sum + Math.floor(Math.random() * f) + 1, 0);
    } else {
      value = Number(constant);
    }
    return [sign, value];
  } else {
    return null;
  }
}
