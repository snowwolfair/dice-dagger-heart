import { Context } from "koishi";
import { Config } from "../config";
import { registerDHDice } from "./commandDHDice";
import { ensureEnabled } from "./commandGugu";

// ==================== 通用掷骰入口 ====================

/** 通用掷骰入口。
 * 以中间件注册通用掷骰（r / .r，所有规则可用），并注册 DH 烹饪（cook）。
 * 二元骰（.dd/.ddr）由基底的 registerDiceSystem 接管。
 * 各中间件内部自行做 gugu 守卫。 */
export function commandDice(ctx: Context, _config: Config) {
  // 注册 DH 烹饪命令（二元骰已由基底 registerDiceSystem 注册）
  registerDHDice(ctx);

  // 通用掷骰：r / .r / 。r（gugu 关闭时静默）
  ctx.middleware(async (session, next) => {
    if (!session?.content) return next();
    const content = session.content.trim();
    const dotted = content.match(/^([。\.]r)/i);
    const plain = !dotted && /^r(\s|$)/i.test(content);
    if (!dotted && !plain) return next();
    if (!(await ensureEnabled(ctx, session))) return;

    if (plain) {
      const values = content.slice(1).trim();
      if (!values) {
        const roll = Math.floor(Math.random() * 6) + 1;
        await session.send(
          `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n${roll}`,
        );
        return;
      }
      await nomalRollResult(values.replace(/\s+/g, ""), session);
      return;
    }

    const rest = content
      .slice(dotted![0].length)
      .trimStart()
      .replace(/\s+/g, "");
    await nomalRollResult(rest, session);
  }, true);
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
async function nomalRollResult(values: string, session: any) {
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

  await session.send(
    `${session.event.user.name} <br/> 掷出了 <hr/> ${detailStr} = ${total}。<br/>`,
  );
}
