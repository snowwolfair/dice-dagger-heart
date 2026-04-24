import { Context, $ } from "koishi";
import {} from "koishi-plugin-puppeteer";
import { Config } from "../config";
import { Property_Dict } from "../utiles/dict";
// import { Character } from "../database";

export interface CreateRoleCommand {
  name: string;
}

export function setRole(ctx: Context) {
  // 设置名称
  ctx.command("pcnew [name] 设置名称").action(async ({ session }, name) => {
    if (!session) return "无法获取用户信息。";
    console.log(session.event.user, session.user);
    const user = session.event.user;
    const groupId = session.guildId;

    const characterExist = await ctx.database
      .select("playercharacter")
      .where((row) => $.eq(row.userid, user.id))
      .where((row) => $.eq(row.groupid, groupId))
      .where((row) => $.eq(row.useable, true))
      .execute();
    if (characterExist.length > 0) {
      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          groupid: groupId,
        },
        {
          useable: false,
        },
      );
    }

    await ctx.database.create("playercharacter", {
      userid: user.id,
      username: user.name,
      groupid: groupId,
      useable: true,
      rolename: name,
    });
    session.send(`新人登场！${name}进入了这幕舞台`);
  });

  // 切换当前登场角色
  ctx
    .command("pcswitch [name] 切换当前登场角色")
    .action(async ({ session }, name) => {
      if (!session) return "无法获取用户信息。";
      console.log(session.event.user, session.user);
      const user = session.event.user;
      const groupId = session.guildId;

      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          groupid: groupId,
        },
        {
          useable: false,
        },
      );

      const characterExist = await ctx.database
        .select("playercharacter")
        .where((row) => $.eq(row.userid, user.id))
        .where((row) => $.eq(row.groupid, groupId))
        .where((row) => $.eq(row.rolename, name))
        .execute();
      if (characterExist.length == 0) {
        session.send(`这幕舞台中，[${name}] 还未曾登场`);
        return;
      } else {
        await ctx.database.set(
          "playercharacter",
          {
            userid: user.id,
            rolename: name,
            groupid: groupId,
          },
          {
            useable: true,
          },
        );
        session.send(`现在登场的角色是：${name}`);
      }
    });

  // 设置属性
  ctx
    .command("st [properties] 设置属性")
    .action(async ({ session }, properties) => {
      if (!session) return "无法获取用户信息。";
      console.log(session.event.user, session.user);
      const user = session.event.user;
      const groupId = session.guildId;

      const character = await ctx.database
        .select("playercharacter")
        .where((row) => $.eq(row.userid, user.id))
        .where((row) => $.eq(row.groupid, groupId))
        .where((row) => $.eq(row.useable, true))
        .execute();
      if (character.length == 0) {
        session.send("你还没有在这一幕舞台中登场,请先使用pcnew创建登场角色");
        return;
      }

      const result: any = {
        experience: [],
      };
      const regex = /([^\d=-]+?)(-?\d+)/g;
      let match;

      while ((match = regex.exec(properties)) !== null) {
        let rawKey = match[1].trim();
        const value = parseInt(match[2], 10); // 属性值，如 1
        if (Property_Dict[rawKey]) {
          result[Property_Dict[rawKey]] = value;
        } else {
          // 3. 存入 experience
          result.experience.push({
            key: rawKey,
            value: value,
          });
        }
      }
      const jsonString = JSON.stringify(result.experience);
      console.log(result);

      await ctx.database.set(
        "playercharacter",
        {
          userid: user.id,
          useable: true,
          groupid: groupId,
        },
        {
          username: user.name,
          "property.agility": result.agility,
          "property.strength": result.strength,
          "property.finesse": result.finesse,
          "property.instinct": result.instinct,
          "property.presence": result.presence,
          "property.knowledge": result.knowledge,

          "armor.value": result.armor,
          "armor.max": result.armor_max,
          "hp.value": result.health,
          "hp.max": result.health_max,

          "stress.value": result.stress,
          "stress.max": result.stress_max,

          "hope.value": result.hope,
          "hope.max": result.hope_max,
          experience: jsonString,
        },
      );
      session.send(`[${character[0].rolename}] 设置属性成功`);

      if (session.platform == "onebot") {
        const cardName = `${character[0].rolename} ${character[0].hope.value}/${character[0].hope.max} ${character[0].hp.value}/${character[0].hp.max} ${character[0].stress.value}/${character[0].stress.max}`;
        session.onebot.setGroupCard(groupId, user.id, cardName);
      }
    });
}

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
