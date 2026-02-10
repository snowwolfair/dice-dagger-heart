// import { Context } from "koishi";
// import {} from "koishi-plugin-puppeteer";
// import { Config } from "../config";
// import { Character } from "../database";

// export interface CreateRoleCommand {
//   name: string;
// }

// export function commandCreateRole(ctx: Context) {
//   ctx
//     .command("crole.create <roledata:text> 匕骰格式输入")
//     .action(async ({ session }, roledata) => {
//       if (!session) return "无法获取用户信息。";
//       const character = JSON.parse(roledata) as CreateRoleCommand;
//       console.log(session.event.user, session.user);
//       const userid = session.event.user.id;
//       const username = session.event.user.name;

//       session.send(
//         `用户 ${username}(${userid}) 已 ${character.name}/${character}。`
//       );
//     });

//   ctx
//     .command("crole.meomeo <roledata:text> 猫骰格式输入")
//     .action(async ({ session }, roledata) => {
//       if (!session) return "无法获取用户信息。";
//       const character = JSON.parse(roledata) as Character;
//       console.log(session.event.user, session.user);
//       const userid = session.event.user.id;
//       const username = session.event.user.name;

//       session.send(
//         `用户 ${username}(${userid}) 已 ${character.rolename}/${character.occupation.class}。`
//       );
//     });

//   ctx
//     .command("crole <roledata>", "猫骰格式输入")
//     .action(async ({ session }, roledata) => {
//       if (!session) return "无法获取用户信息。";
//       // const character = JSON.parse(roledata) as CreateRoleCommand;
//       console.log(session.event.user, session.user);
//       const userid = session.event.user.id;
//       const username = session.event.user.name;
//       await ctx.database.create("character", {
//         userid: userid,
//         username: username,
//         rolename: "影刃·莉亚",

//         occupation: {
//           class: "游荡者",
//           subclass: "暗影行者",
//         },

//         race: {
//           name: "半精灵",
//           characteristic: ["敏锐感知", "魅力加成", "夜视能力"],
//         },

//         community: {
//           name: "灰港同盟",
//           characteristic: "情报网络发达，擅长隐秘行动",
//         },

//         property: {
//           agility: 14,
//           strength: 10,
//           finesse: 13,
//           instinct: 12,
//           presence: 11,
//           knowledge: 9,
//         },

//         evasion: 8,

//         armor: {
//           name: "秘银轻甲",
//           value: 5,
//           max: 6,
//         },

//         hp: {
//           value: 18,
//           max: 20,
//         },

//         stress: {
//           value: 3,
//           max: 10,
//         },

//         hope: {
//           value: 7,
//           max: 10,
//         },

//         primaryweapons: "双持短剑「鸦羽」",
//         secondaryweapons: "袖箭 + 烟雾弹",

//         proficiency: {
//           value: 4,
//           max: 5,
//         },

//         backpack: [
//           "治疗药水 x2",
//           "开锁工具组",
//           "伪装面具",
//           "灰港徽记",
//           "日记本（加密）",
//         ],

//         background:
//           "曾是贵族私生女，因家族政变流落街头，后被灰港收留，成为情报刺客。",

//         experience: [
//           "潜入黑市拍卖会，窃取古代卷轴",
//           "在雪原追踪叛逃特工三日",
//           "单人摧毁邪教据点",
//         ],

//         field: ["城市巷战", "情报刺探", "夜间突袭"],
//       });

//       // session.send(
//       //   `用户 ${username}(${userid}) 已 ${character.name}/${character}。`
//       // );
//     });
// }
