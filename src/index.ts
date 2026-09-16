import { Context, Database, Schema, $, z } from "koishi";
// import { Character, Field } from "./database";
// import { createCharacterTable, createFieldTable } from "./database";
import {} from "koishi-plugin-adapter-onebot";
import { createPlayerCharacterTable, createGroupStateTable, createDiceLogTable, createDiceLogLineTable } from "./utiles/database";
import { DataService } from "@koishijs/plugin-console";
import { resolve } from "path";
import { commandDice } from "./commands/commandDice";
import { setRole } from "./commands/commandCreateRole";
import { setBoard } from "./commands/commandBoard";
import { setGugu } from "./commands/commandGugu";
import { setRule } from "./commands/commandRule";
import { setLog } from "./commands/commandLog";
import { DiceCoreService, DiceSystemConfig } from "./types";
import { registerDiceSystem } from "./diceCore";
import { registerRule } from "./utiles/rules";
import { getCurrentRule } from "./commands/commandRule";
import { isGroupEnabled } from "./commands/commandGugu";
import { listenCommand } from "./utiles/listenCommand";
import { Property_Dict, PRO_CON_Dict } from "./utiles/dict";
import { buildCardName } from "./commands/commandCreateRole";
// import { Config } from "./config";

export const name = "dice-dagger-heart";

export const inject = {
  required: ["database"],
  optional: ["console", "puppeteer"],
};

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
  // 建表
  createGroupStateTable(ctx);
  createPlayerCharacterTable(ctx);
  createDiceLogTable(ctx);
  createDiceLogLineTable(ctx);

  // 挂载 DiceCore 服务：扩展插件通过 ctx.diceCore.* 接入
  // 使用 ctx.set() 注册为 Cordis 服务，扩展插件可通过 inject.required 声明依赖
  // 使用局部变量避免 DH 自身通过代理访问 ctx.diceCore 触发警告
  const diceCore = {
    registerRule: (rule: any) => registerRule(rule),
    registerDiceSystem: (ctx2: any, cfg: any) => registerDiceSystem(ctx2, cfg),
    ruleCommand: (ctx2: any, ruleKey: string, decl: any, action: any) => {
      // 中间件注册，自动包裹 gugu + 规则守卫：关闭或非当前规则时静默不响应
      const name = String(decl || "").trim().split(/\s+/)[0];
      if (!name) return;
      listenCommand(ctx2, name, async (session, args) => {
        const current = await getCurrentRule(ctx2, session.guildId || "");
        if (current !== ruleKey) return;
        return action({ session }, ...args);
      });
    },
    ensureRule: async (session: any, key: string) => {
      const current = await getCurrentRule(ctx, session.guildId || "");
      return current === key;
    },
    ensureEnabled: async (session: any) => {
      return isGroupEnabled(ctx, session.guildId || "");
    },
  };
  ctx.set("diceCore", diceCore);

  // 注册通用掷骰（r/.r，所有规则可用）
  commandDice(ctx, config);

  // DH 自身作为一份配置注册（不再是特殊的）
  // 注意：rules.ts 中已内置 DH 规则定义，此处只注册二元骰系统
  const DH_CONFIG: DiceSystemConfig = {
    ruleKey: "DH",
    diceSides: 12,
    positiveDieName: "希望骰",
    negativeDieName: "恐惧骰",
    outcomes: {
      positive: {
        label: "希望结果",
        quotes: config.hopeResultText,
        showTotal: true,
        resources: [
          {
            target: "player",
            field: "hope",
            direction: 1,
            cap: 6,
            displayLabel: "[希望值变化]",
            defaultValue: 2,
            capLabel: "6(已满)",
          },
        ],
      },
      negative: {
        label: "恐惧结果",
        quotes: config.despairResultText,
        showTotal: true,
        resources: [
          {
            target: "gm",
            field: "fear",
            direction: 1,
            cap: 12,
            displayLabel: "[恐惧点变化]",
            defaultValue: 0,
            capLabel: "12(已满)",
          },
        ],
      },
      critical: {
        label: "关键成功！",
        quotes: config.wonderfulResultText,
        showTotal: false,
        resources: [
          {
            target: "player",
            field: "hope",
            direction: 1,
            cap: 6,
            displayLabel: "[希望值变化]",
            defaultValue: 2,
            capLabel: "6(已满)",
          },
          {
            target: "player",
            field: "stress",
            direction: -1,
            cap: 0,
            displayLabel: "[压力值变化]",
            defaultValue: 0,
            capLabel: "0",
          },
        ],
      },
    },
    propertyDict: Property_Dict,
    proConDict: PRO_CON_Dict,
    characterTable: "playercharacter",
    gmRoleName: "GM",
    buildCardName,
  };

  // 注册 DH 二元骰系统（自动注册 .dd/.ddr 中间件，带规则路由+gugu守卫）
  diceCore.registerDiceSystem(ctx, DH_CONFIG);

  // DH 专属命令（角色卡、cook、showplayer 等）
  setBoard(ctx);
  setRole(ctx);
  setGugu(ctx);
  setRule(ctx);

  // 跑团日志（所有规则通用，不受 gugu/规则限制）
  setLog(ctx);
}
