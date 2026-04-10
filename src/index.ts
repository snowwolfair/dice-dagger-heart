import { Context, Database, Schema, $, z } from "koishi";
// import { Character, Field } from "./database";
// import { createCharacterTable, createFieldTable } from "./database";
// import { commandCreateRole } from "./commands/commandCreateRole";
import { DataService } from "@koishijs/plugin-console";
import { resolve } from "path";
import { commandDice } from "./commands/commandDice";
// import { Config } from "./config";

export const name = "dice-dagger-heart";

export const inject = ["database", "console"];

// declare module "koishi" {
//   interface Tables {
//     character: Character;
//     field: Field;
//   }
// }

// declare module "@koishijs/plugin-console" {
//   namespace Console {
//     interface Services {
//       custom: CustomProvider;
//     }
//   }
// }

// class CustomProvider extends DataService<string[]> {
//   constructor(ctx: Context) {
//     super(ctx, "custom");
//   }

//   async get() {
//     return ["Hello", "World"];
//   }
// }

export interface Config {
  hopeResultText: string[];
  despairResultText: string[];
  wonderfulResultText: string[];
}
export const Config: Schema<Config> = Schema.object({
  hopeResultText: Schema.array(Schema.string())
    .default(["恐惧消散，希望涌起"])
    .description("希望结果的显示文字"),
  despairResultText: Schema.array(Schema.string())
    .default(["希望消散，恐惧滋生"])
    .description("恐惧结果的显示文字"),
  wonderfulResultText: Schema.array(Schema.string())
    .default(["世界聚焦于你"])
    .description("关键成功结果的显示文字"),
});

export const usage = `
<h1>匕首之心bot</h1>

<p>目前仅测试了 <b>Onebot</b> 协议</p>

<p>仓库地址：<a href="https://github.com/snowwolfair/dice-dagger-heart">https://github.com/snowwolfair/dice-dagger-heart</a></p>

<p style="color: #f39c12;">插件使用问题 / Bug反馈 / 建议 请 添加企鹅群 156529412 或在仓库中发 issue </p>

`;
export async function apply(ctx: Context, config: Config) {
  // createFieldTable(ctx);
  // createCharacterTable(ctx);
  // commandCreateRole(ctx);
  commandDice(ctx, config);

  // ctx.plugin(CustomProvider);

  // ctx.command("dice").action(async ({ session }) => {
  //   if (!session.user) return "无法获取用户信息。";
  // });

  // ctx.inject(["console"], (ctx) => {
  //   ctx.console.addEntry({
  //     dev: resolve(__dirname, "../client/index.ts"),
  //     prod: resolve(__dirname, "../dist"),
  //   });
  // });
}
