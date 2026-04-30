import { Context, $, Session } from "koishi";
import { Config } from "../config";
import { Property_Dict, PRO_CON_Dict } from "../utiles/dict";

export function commandDice(ctx: Context, config: Config) {
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
      rollResult(rest, despair, hope, session, ctx, result, config);
    }
    if (prefixMatchR) {
      // 2. 提取前缀后的剩余字符串，并去除首尾空白
      const rest = session.content.slice(prefixMatchR[0].length).trimStart();

      // 3. 调用结果方程
      nomalRollResult(rest, session);
    }
    return next();
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
async function rollResult(
  rest: string,
  despair: number,
  hope: number,
  session: Session,
  ctx: Context,
  result: number,
  config: Config,
) {
  const user = session.event.user;
  const groupId = session.guildId;
  const character = await ctx.database
    .select("playercharacter")
    .where((row) => $.eq(row.userid, session.event.user.id))
    .where((row) => $.eq(row.groupid, session.guildId))
    .where((row) => $.eq(row.useable, true))
    .execute();
  console.log(character);
  const normalHope = 2;
  const hopeChange = () => {
    if (character.length == 0) {
      return `${normalHope}->${normalHope + 1}`;
    } else {
      if (character[0].hope.value == 6) {
        return `6`;
      } else {
        return `${character[0].hope.value}->${character[0].hope.value + 1}`;
      }
    }
  };

  const normalStress = 0;
  const stressChange = () => {
    if (character.length == 0) {
      return `${normalStress}->${normalStress - 1}`;
    } else {
      if (character[0].stress.value == 0) {
        return `0`;
      } else {
        return `${character[0].stress.value}->${character[0].stress.value - 1}`;
      }
    }
  };

  if (rest === "") {
    if (hope > despair) {
      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          useable: true,
          groupid: groupId,
        },
        (row) => ({
          "hope.value": $.min([$.add(row.hope.value, 1), 6]),
        }),
      );

      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair}\n-------------------------------------------\n      合计 ${result}         希望结果\n[希望值变化]: ${hopeChange()} \n[命运的寄语]: ${hopeful(config)}      `,
      );
    } else if (hope < despair) {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair}\n-------------------------------------------\n      合计 ${result}         恐惧结果\n[命运的寄语]: ${desperate(config)}      `,
      );
    } else {
      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          useable: true,
          groupid: groupId,
        },
        (row) => ({
          "hope.value": $.min([$.add(row.hope.value, 1), 6]),
          "stress.value": $.max([$.subtract(row.stress.value, 1), 0]),
        }),
      );
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n--------------------------------------------\n希望骰 ${hope}        与        恐惧骰 ${despair} \n-------------------------------------------\n            关键成功！\n[希望值变化]: ${hopeChange()}\n[压力值变化]: ${stressChange()}\n[命运的寄语]: ${wonderful(config)}      `,
      );
    }
  } else {
    const termRegex = /([+-]?)\s*(?:(\d*)d(\d+)|([^+-]+?))(?=\s*[+-]|$)/g;
    const terms = Array.from(rest.matchAll(termRegex));
    // 4. 检查是否完整匹配（防止中间有非法字符）
    const reconstructed = terms.map((t) => t[0]).join("");
    if (reconstructed.replace(/\s+/g, "") !== rest.replace(/\s+/g, "")) {
      throw new Error(`表达式包含非法内容："${rest}"`);
    }

    // 5. 计算总和
    let total = 0;
    let i = 0;
    const adjustments: string[] = [];

    while (i < terms.length) {
      const str = terms[i][0].replace(/\s+/g, ""); // 去掉内部空格，如 "+ 1d6" → "+1d6"
      const matchResult = diceMatch(str);
      if (matchResult) {
        const [op, value] = matchResult;
        const signedStr = op === "+" ? `+${value}` : `-${value}`;
        adjustments.push(signedStr);
        total += op === "+" ? value : -value;
        i++;
      } else {
        const nameMatch = str.match(/^([+-]?)(.*)$/);
        const pureName = nameMatch[2].trim();

        if (Property_Dict[pureName]) {
          if (character.length > 0) {
            const signedStr =
              character[0].property[Property_Dict[pureName]] > 0
                ? `+${character[0].property[Property_Dict[pureName]]}[${pureName}]`
                : `${character[0].property[Property_Dict[pureName]]}[${pureName}]`;
            adjustments.push(signedStr);
            total +=
              character[0].property[Property_Dict[pureName]] > 0
                ? Number(character[0].property[Property_Dict[pureName]])
                : Number(character[0].property[Property_Dict[pureName]]);
            i++;
          } else {
            session.send(`舞台上还没有这位角色"${pureName}"的属性值`);
            return;
          }
        } else if (
          PRO_CON_Dict[pureName] &&
          diceMatch(PRO_CON_Dict[pureName])
        ) {
          const [opD, valueD] = diceMatch(PRO_CON_Dict[pureName]);
          const signedStrD = opD === "+" ? `+${valueD}` : `-${valueD}`;
          adjustments.push(signedStrD);
          total += opD === "+" ? valueD : -valueD;
          i++;
        } else {
          if (!character || character.length === 0) {
            session.send(`无法解析项，且未找到角色信息："${str}"`);
            return;
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
            const signedStr = `+${experienceObject[pureName]}[${pureName}]`;
            adjustments.push(signedStr);
            total += Number(experienceObject[pureName]);
            i++;
          } else {
            session.send(`无法解析项："${str}"`);
            throw new Error(`无法解析项："${str}"`);
          }
        }
      }
    }

    if (hope > despair) {
      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          useable: true,
          groupid: groupId,
        },
        (row) => ({
          "hope.value": $.min([$.add(row.hope.value, 1), 6]),
        }),
      );
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n调整值: ${adjustments.join(",")}\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair}\n-------------------------------------------\n      合计 ${result + total}       希望结果\n[希望值变化]: ${hopeChange()} \n[命运的寄语]: ${hopeful(config)}      `,
      );
    } else if (hope < despair) {
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n调整值: ${adjustments.join(",")}\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair}\n-------------------------------------------\n      合计 ${result + total}       恐惧结果\n[命运的寄语]: ${desperate(config)}      `,
      );
    } else {
      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          useable: true,
          groupid: groupId,
        },
        (row) => ({
          "hope.value": $.min([$.add(row.hope.value, 1), 6]),
          "stress.value": $.max([$.subtract(row.stress.value, 1), 0]),
        }),
      );
      session.send(
        `${session.event.user.name} 掷出了它的命运，结果会是什么呢\n调整值: ${adjustments.join(",")}\n--------------------------------------------\n希望骰 ${hope}       与        恐惧骰 ${despair}\n-------------------------------------------\n           关键成功！\n[希望值变化]: ${hopeChange()}\n[压力值变化]: ${stressChange()}\n[命运的寄语]: ${wonderful(config)}      `,
      );
    }
    // session.send(hope > 9 && "<div>欢迎回来，用户！</div>");
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

// 正则匹配为骰子时的方法
function diceMatch(str: string): [string, number] | null {
  const match = str.match(/^([+-])((\d*)d(\d+)|(\d+))$/);
  if (match) {
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
    return [op, value];
  } else {
    return null;
  }
}

// 希望结果
function hopeful(config: Config) {
  if (config.hopeResultText.length === 0) {
    return "";
  } else {
    return config.hopeResultText[
      Math.floor(Math.random() * config.hopeResultText.length)
    ];
  }
}

// 恐惧结果
function desperate(config: Config) {
  if (config.despairResultText.length === 0) {
    return "";
  } else {
    return config.despairResultText[
      Math.floor(Math.random() * config.despairResultText.length)
    ];
  }
}

// 关键成功结果
function wonderful(config: Config) {
  if (config.wonderfulResultText.length === 0) {
    return "";
  } else {
    return config.wonderfulResultText[
      Math.floor(Math.random() * config.wonderfulResultText.length)
    ];
  }
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
  "制胜的一击",
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
