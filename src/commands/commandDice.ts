import { Context, $, Session } from "koishi";

export function commandDice(ctx: Context, config) {
  ctx.command("r [values] 掷骰子").action(async ({ session }, values) => {
    if (!session) return "无法获取用户信息。";

    if (!values) {
      const roll = Math.floor(Math.random() * 6) + 1;
    }

    const extraTypeStr =
      /^[+-]?(?:[1-9]\d*d[1-9]\d*|[1-9]\d*)(?:[+-](?:[1-9]\d*d[1-9]\d*|[1-9]\d*))*$/;
    if (!extraTypeStr.test(values)) return "骰子类型格式错误。";

    const termMatches = values.match(/[+-]?(?:[1-9]\d*d[1-9]\d*|[1-9]\d*)/g);
    if (!termMatches) return "骰子类型格式错误。";

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

      const parsed = parseTerm(content); // 假设 parseTerm 只接收无符号字符串
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
      `用户 ${session.event.user.name} <br/> 掷出了 <hr/> ${detailStr} = ${total}。<br/>`,
    );
  });

  // ctx
  //   .command("dd [values:text]", "掷二元骰")
  //   .action(async ({ session }, values) => {
  //     if (!session) return "无法获取用户信息。";
  //     const [hope, despair] = rollTwoDice(1);
  //     const extraTypeStr =
  //       /^[+-]?(?:[1-9]\d*d[1-9]\d*|[1-9]\d*)(?:[+-](?:[1-9]\d*d[1-9]\d*|[1-9]\d*))*$/;
  //     const result = hope + despair;
  //     console.log(values);
  //     if (!values) {
  //       if (hope > despair) {
  //         session.send(
  //           `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n合计 ${result}         希望结果`,
  //         );
  //       } else if (hope < despair) {
  //         session.send(
  //           `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n合计 ${result}         恐惧结果`,
  //         );
  //       } else {
  //         session.send(
  //           `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}        与        恐惧骰 ${despair} \n -------------------------------------------\n        关键成功！`,
  //         );
  //       }
  //     } else {
  //       if (!extraTypeStr.test(values)) return "调整值格式错误。";
  //       const termMatches = values.match(
  //         /[+-]?(?:[1-9]\d*d[1-9]\d*|[1-9]\d*)/g,
  //       );
  //       if (!termMatches) return "骰子类型格式错误。";
  //       let terms = termMatches;
  //       if (!/^[+-]/.test(values)) {
  //         terms = ["+" + termMatches[0], ...termMatches.slice(1)];
  //       }

  //       let total = 0;
  //       const details: string[] = [];

  //       for (const term of terms) {
  //         const sign = term.startsWith("-") ? -1 : 1;
  //         const content =
  //           term.startsWith("+") || term.startsWith("-") ? term.slice(1) : term;

  //         const parsed = parseTerm(content); // 假设 parseTerm 只接收无符号字符串
  //         if (parsed.type === "dice") {
  //           let sum = 0;
  //           const rolls: number[] = [];
  //           for (let i = 0; i < parsed.count!; i++) {
  //             const roll = Math.floor(Math.random() * parsed.faces!) + 1;
  //             rolls.push(roll);
  //             sum += roll;
  //           }
  //           total += sign * sum;
  //           const rollStr = `(${rolls.join("+")})`;
  //           details.push((sign === -1 ? "-" : "+") + rollStr);
  //         } else {
  //           const value = parsed.value!;
  //           total += sign * value;
  //           details.push((sign === -1 ? "-" : "+") + value.toString());
  //         }
  //       }

  //       // 优化显示：去掉开头的 '+'
  //       let detailStr = details.join("");
  //       if (detailStr.startsWith("+")) {
  //         detailStr = detailStr.slice(1);
  //       }
  //       if (hope > despair) {
  //         session.send(
  //           `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n加值: ${details.join("+")}       合计 ${result + total}       希望结果`,
  //         );
  //       } else if (hope < despair) {
  //         session.send(
  //           `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n加值: ${details.join("+")}       合计 ${result + total}       恐惧结果`,
  //         );
  //       } else {
  //         session.send(
  //           `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n        关键成功！`,
  //         );
  //       }
  //     }

  //     // const playerName = await getPlayerName(ctx, session);
  //   });
  ctx.middleware((session, next) => {
    if (!session) return "无法获取用户信息。";
    const prefixMatch = session.content.match(/^([。\.]dd)/i);
    if (prefixMatch) {
      const [hope, despair] = rollTwoDice(1);
      const result = hope + despair;

      // 2. 提取前缀后的剩余字符串，并去除首尾空白
      const rest = session.content.slice(prefixMatch[0].length).trimStart();

      if (rest === "") {
        if (hope > despair) {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n合计 ${result}         希望结果`,
          );
        } else if (hope < despair) {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n合计 ${result}         恐惧结果`,
          );
        } else {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}        与        恐惧骰 ${despair} \n -------------------------------------------\n        关键成功！`,
          );
        }
      } else {
        const termRegex = /[+-]\s*(?:\d*d\d+|\d+)/g;
        const terms = Array.from(rest.matchAll(termRegex));

        // 4. 检查是否完整匹配（防止中间有非法字符）
        const reconstructed = terms.map((t) => t[0]).join("");
        if (reconstructed.replace(/\s+/g, "") !== rest.replace(/\s+/g, "")) {
          throw new Error(`表达式包含非法内容："${rest}"`);
        }

        // 5. 计算总和
        let total = 0;
        const adjustments: string[] = [];

        for (const term of terms) {
          const str = term[0].replace(/\s+/g, ""); // 去掉内部空格，如 "+ 1d6" → "+1d6"
          const match = str.match(/^([+-])((\d*)d(\d+)|(\d+))$/);
          if (!match) {
            throw new Error(`无法解析项："${str}"`);
          }

          const [, op, , diceCount, faces, constant] = match;
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

          const signedStr = op === "+" ? `+${value}` : `-${value}`;
          adjustments.push(signedStr);
          total += op === "+" ? value : -value;
        }

        if (hope > despair) {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n调整值: ${adjustments.join(",")}       合计 ${result + total}       希望结果`,
          );
        } else if (hope < despair) {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n调整值: ${adjustments.join(",")}       合计 ${result + total}       恐惧结果`,
          );
        } else {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n        关键成功！`,
          );
        }
      }
    }
  });
}

function parseTerm(term: string): {
  type: "dice" | "number";
  count?: number;
  faces?: number;
  value?: number;
} {
  const diceMatch = term.match(/^([1-9]\d*)d([1-9]\d*)$/i);
  if (diceMatch) {
    return {
      type: "dice",
      count: parseInt(diceMatch[1], 10),
      faces: parseInt(diceMatch[2], 10),
    };
  }

  const numMatch = term.match(/^[1-9]\d*$/);
  if (numMatch) {
    return {
      type: "number",
      value: parseInt(term, 10),
    };
  }

  throw new Error(`无效项: ${term}`);
}

// 二元骰 希望骰与绝望骰
function rollTwoDice(count: number): number[] {
  const hope = Math.floor(Math.random() * 12) + 1;
  const despair = Math.floor(Math.random() * 12) + 1;
  return [hope, despair];
}

// 获取玩家名
// async function getPlayerName(ctx: Context, session: Session) {
//   const user = await ctx.database.get(
//     "character",
//     {
//       userid: session.event.user.id,
//     },
//     ["rolename"]
//   );
//   return user[0].rolename;
// }
