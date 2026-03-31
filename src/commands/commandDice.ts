import { Context, $, Session } from "koishi";

export function commandDice(ctx: Context, config) {
  ctx.command("r [values] 掷骰子").action(async ({ session }, values) => {
    if (!session) return "无法获取用户信息。";

    if (!values) {
      const roll = Math.floor(Math.random() * 6) + 1;
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n${roll}`,
      );
      return;
    }

    nomalRollResult(values, session);
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
    const prefixMatchR = session.content.match(/^([。\.]r)/i);
    if (prefixMatch) {
      const [hope, despair] = rollTwoDice(1);
      const result = hope + despair;

      // 2. 提取前缀后的剩余字符串，并去除首尾空白
      const rest = session.content.slice(prefixMatch[0].length).trimStart();

      // 3. 调用结果方程
      rollResult(rest, despair, hope, session, result);
    }
    if (prefixMatchR) {
      // 2. 提取前缀后的剩余字符串，并去除首尾空白
      const rest = session.content.slice(prefixMatchR[0].length).trimStart();

      // 3. 调用结果方程
      nomalRollResult(rest, session);
    }
  });
}

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

    return {
      type: "dice",
      count,
      faces,
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

// 掷骰结果方程
function rollResult(
  rest: string,
  despair: number,
  hope: number,
  session: Session,
  result: number,
) {
  if (rest === "") {
    if (hope > despair) {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n
--------------------------------------------\n
希望骰 ${hope}       与        恐惧骰 ${despair} \n
-------------------------------------------\n
合计 ${result}         希望结果\n
${hopeful()}      `,
      );
    } else if (hope < despair) {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n
--------------------------------------------\n
希望骰 ${hope}       与        恐惧骰 ${despair} \n
-------------------------------------------\n
合计 ${result}         恐惧结果\n
${desperate()}      `,
      );
    } else {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n
--------------------------------------------\n
希望骰 ${hope}        与        恐惧骰 ${despair} \n
-------------------------------------------\n
            关键成功！\n
${wonderful()}      `,
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
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n
--------------------------------------------\n
希望骰 ${hope}       与        恐惧骰 ${despair} \n
-------------------------------------------\n
调整值: ${adjustments.join(",")}       合计 ${result + total}       希望结果\n
${hopeful()}      `,
      );
    } else if (hope < despair) {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n
--------------------------------------------\n
希望骰 ${hope}       与        恐惧骰 ${despair} \n
-------------------------------------------\n
调整值: ${adjustments.join(",")}       合计 ${result + total}       恐惧结果\n
${desperate()}      `,
      );
    } else {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n
--------------------------------------------\n
希望骰 ${hope}       与        恐惧骰 ${despair} \n
-------------------------------------------\n
           关键成功！\n
${wonderful()}      `,
      );
    }
  }
}

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
    `${session.event.user.name} <br/> 掷出了 <hr/> ${detailStr} = ${total}。<br/>`,
  );
}

// 希望结果
function hopeful() {
  return hopefuljson[Math.floor(Math.random() * hopefuljson.length)];
}

// 恐惧结果
function desperate() {
  return desperatejson[Math.floor(Math.random() * desperatejson.length)];
}

// 关键成功结果
function wonderful() {
  return wonderfuljson[Math.floor(Math.random() * wonderfuljson.length)];
}



let hopefuljson = [
  "黎明时的第一束阳光，前方的道路正是希望",
  "命运的纺车吱呀作响，汇聚所有人的希望",
  "无垠的旷野中，抽出的新芽带来了初生的希望",
  "在黑暗中，你将发现新的希望",
  "恐惧消散，希望涌起",
];

let desperatejson = [
  "希望消散，恐惧滋生",
  "恐惧的藤蔓攀上了你的肩头",
  "命运的纺锤落下，恐惧开始侵扰",
  "光芒熄灭了，恐惧在黑暗中成长",
  "钟声敲响，恐惧应声而鸣",
];

let wonderfuljson = [
  "命运女神的骰子总是6点朝上",
  "命运的纺车为你编制华衣",
  "命运女神亲吻了你的脸颊",
  "此即命定之时，英雄即将出现",
];

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
