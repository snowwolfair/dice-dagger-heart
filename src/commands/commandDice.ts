import { Context, $, Session } from "koishi";

export function commandDice(ctx: Context, config) {
  ctx.command("r [values] 掷骰子").action(async ({ session }, values) => {
    if (!session) return "无法获取用户信息。";

    if (!values) {
      const roll = Math.floor(Math.random() * 6) + 1;
    }

    const extraTypeStr =
      /^(?:[1-9]\d*d[1-9]\d*|[1-9]\d*)(?:\+(?:[1-9]\d*d[1-9]\d*|[1-9]\d*))*$/;
    if (!extraTypeStr.test(values)) return "骰子类型格式错误。";

    const terms = values.split("+");
    let total = 0;
    const details: string[] = [];

    for (const term of terms) {
      const parsed = parseTerm(term);
      if (parsed.type === "dice") {
        // 掷骰子
        let sum = 0;
        const rolls: number[] = [];
        for (let i = 0; i < parsed.count!; i++) {
          const roll = Math.floor(Math.random() * parsed.faces!) + 1;
          rolls.push(roll);
          sum += roll;
        }
        total += sum;
        details.push(`(${rolls.join("+")})`); // 如 (3+5)
      } else {
        // 固定数值
        total += parsed.value!;
        details.push(parsed.value!.toString());
      }
    }

    session.send(
      `用户 ${session.event.user.name} <br/> 掷出了 <hr/> ${details.join("+")} = ${total}。<br/>`,
    );
  });

  ctx
    .command("dd [values:text]", "掷二元骰")
    .action(async ({ session }, values) => {
      if (!session) return "无法获取用户信息。";
      const [hope, despair] = rollTwoDice(1);
      const extraTypeStr =
        /^\+(?:[1-9]\d*d[1-9]\d*|[1-9]\d*)(?:\+(?:[1-9]\d*d[1-9]\d*|[1-9]\d*))*$/;
      const result = hope + despair;
      if (!values) {
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
        if (!extraTypeStr.test(values)) return "加值格式错误。";
        const terms = values.split("+");
        terms.shift();
        let total = 0;
        const details: string[] = [];

        for (const term of terms) {
          const parsed = parseTerm(term);
          if (parsed.type === "dice") {
            // 掷骰子
            let sum = 0;
            const rolls: number[] = [];
            for (let i = 0; i < parsed.count!; i++) {
              const roll = Math.floor(Math.random() * parsed.faces!) + 1;
              rolls.push(roll);
              sum += roll;
            }
            total += sum;
            details.push(`(${rolls.join("+")})`); // 如 (3+5)
          } else {
            // 固定数值
            total += parsed.value!;
            details.push(parsed.value!.toString());
          }
        }
        if (hope > despair) {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n加值: ${details.join("+")}       合计 ${result + total}       希望结果`,
          );
        } else if (hope < despair) {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n加值: ${details.join("+")}       合计 ${result + total}       恐惧结果`,
          );
        } else {
          session.send(
            `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair} \n -------------------------------------------\n        关键成功！`,
          );
        }
      }

      // const playerName = await getPlayerName(ctx, session);
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
