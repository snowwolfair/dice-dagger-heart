import { Context, Database, Schema, $ } from "koishi";
// import { Character, Field } from "./database";
// import { createCharacterTable, createFieldTable } from "./database";
// import { commandCreateRole } from "./commands/commandCreateRole";
import { commandDice } from "./commands/commandDice";
import { ConfigSchema } from "./config";

export const name = "dice-dagger-heart";

export const inject = ["database"];

// declare module "koishi" {
//   interface Tables {
//     character: Character;
//     field: Field;
//   }
// }

export const usage = `
<h1>匕首之心bot</h1>

<p>目前仅测试了 <b>Onebot</b> 协议</p>

<p>仓库地址：<a href="https://github.com/snowwolfair/dice-dagger-heart">https://github.com/snowwolfair/dice-dagger-heart</a></p>

<p style="color: #f39c12;">插件使用问题 / Bug反馈 / 建议 请 添加企鹅群 156529412 或在仓库中发 issue </p>

`;
export async function apply(ctx: Context, config) {
  // createFieldTable(ctx);
  // createCharacterTable(ctx);
  // commandCreateRole(ctx);
  commandDice(ctx, config);

  // ctx.command("dice").action(async ({ session }) => {
  //   if (!session.user) return "无法获取用户信息。";
  // });
}
