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

    if (!name) {
      session.send("请输入角色名称");
      return;
    }

    const characterExist = await ctx.database
      .select("playercharacter")
      .where((row) => $.eq(row.userid, user.id))
      .where((row) => $.eq(row.groupid, groupId))
      .where((row) => $.eq(row.rolename, name))
      .execute();
    if (characterExist.length > 0) {
      session.send(`角色${name}已存在,已自动切换到对应角色`);
      await switchRoles(ctx, session, name);
      return;
    }

    const characterUseable = await ctx.database
      .select("playercharacter")
      .where((row) => $.eq(row.userid, user.id))
      .where((row) => $.eq(row.groupid, groupId))
      .where((row) => $.eq(row.useable, true))
      .execute();
    if (characterUseable.length > 0) {
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
      property: {
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
      },
      armor: {
        value: 0,
        max: 0,
      },
      hp: {
        value: 0,
        max: 0,
      },
      stress: {
        value: 0,
        max: 0,
      },
      hope: {
        value: 0,
        max: 0,
      },
      major: 0,
      severe: 0,
      experience: "",
    });
    session.send(`新人登场！${name}进入了这幕舞台`);
  });

  // 切换当前登场角色
  ctx
    .command("pcswitch [name] 切换当前登场角色")
    .alias("pccg")
    .action(async ({ session }, name) => {
      if (!session) return "无法获取用户信息。";
      console.log(session.event.user, session.user);
      const user = session.event.user;
      const avatar = user?.avatar ?? "";
      const groupId = session.guildId;
      if (!name) {
        session.send("请输入切换角色名称");
        return;
      }
      await switchRoles(ctx, session, name);
    });

  // 设置属性
  ctx.middleware(async (session, next) => {
    if (!session) return "无法获取用户信息。";
    const prefixMatch = session.content.match(/^([。\.]st)/i);
    if (prefixMatch) {
      // 2. 提取前缀后的剩余字符串，并去除首尾空白
      const rest = session.content.slice(prefixMatch[0].length).trimStart();

      // 3. 调用结果方程
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
        experience: JSON.parse(character[0].experience || "[]") || [],
      };
      const regex = /([^\d=-]+?)([-+]?\d+)/g;
      let match;

      while ((match = regex.exec(rest)) !== null) {
        let rawKey = match[1].trim();
        const value = parseInt(match[2], 10); // 属性值，如 1
        if (Property_Dict[rawKey]) {
          result[Property_Dict[rawKey]] = value;
        } else {
          if (rawKey == "恐惧" || rawKey == "恐惧上限") {
            continue;
          }
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
          "property.agility": $.add(
            character[0].property.agility,
            result.agility || 0,
          ),
          "property.strength": $.add(
            character[0].property.strength,
            result.strength || 0,
          ),
          "property.finesse": $.add(
            character[0].property.finesse,
            result.finesse || 0,
          ),
          "property.instinct": $.add(
            character[0].property.instinct,
            result.instinct || 0,
          ),
          "property.presence": $.add(
            character[0].property.presence,
            result.presence || 0,
          ),
          "property.knowledge": $.add(
            character[0].property.knowledge,
            result.knowledge || 0,
          ),

          "armor.value": $.add(character[0].armor.value, result.armor || 0),
          "armor.max": $.add(character[0].armor.max, result.armor_max || 0),
          "hp.value": $.add(character[0].hp.value, result.health || 0),
          "hp.max": $.add(character[0].hp.max, result.health_max || 0),

          "stress.value": $.add(character[0].stress.value, result.stress || 0),
          "stress.max": $.add(character[0].stress.max, result.stress_max || 0),

          "hope.value": $.add(character[0].hope.value, result.hope || 0),
          "hope.max": $.add(character[0].hope.max, result.hope_max || 0),
          major: $.add(character[0].major, result.major || 0),
          severe: $.add(character[0].severe, result.severe || 0),
          experience: jsonString,
        },
      );
      session.send(`[${character[0].rolename}] 设置属性成功`);
      const nowRole = await ctx.database
        .select("playercharacter")
        .where((row) => $.eq(row.userid, user.id))
        .where((row) => $.eq(row.groupid, groupId))
        .where((row) => $.eq(row.useable, true))
        .execute();

      const cardName = `${nowRole[0].rolename} 希望${nowRole[0].hope.value}/${nowRole[0].hope.max} 生命${nowRole[0].hp.value}/${nowRole[0].hp.max} 压力${nowRole[0].stress.value}/${nowRole[0].stress.max}`;
      console.log(cardName);

      if (session.platform == "onebot") {
        const cardName = `${nowRole[0].rolename} 希望${nowRole[0].hope.value}/${nowRole[0].hope.max} 生命${nowRole[0].hp.value}/${nowRole[0].hp.max} 压力${nowRole[0].stress.value}/${nowRole[0].stress.max}`;
        session.onebot.setGroupCard(groupId, user.id, cardName);
      }
    }
    return next();
  });

  ctx.command("pclist 列出所有角色").action(async ({ session }) => {
    if (!session) return "无法获取用户信息。";
    console.log(session.event.user, session.user);
    const user = session.event.user;
    const groupId = session.guildId;

    const characterExist = await ctx.database
      .select("playercharacter")
      .where((row) => $.eq(row.userid, user.id))
      .where((row) => $.eq(row.groupid, groupId))
      .execute();
    if (characterExist.length > 0) {
      const characterList = characterExist.map((row) => {
        if (row.useable == true) {
          return `${row.rolename}(登场中)`;
        } else {
          return `${row.rolename}`;
        }
      });
      session.send(`你这一幕舞台中登场过的角色有：${characterList.join(", ")}`);
    } else {
      session.send(`你这一幕舞台中没有登场的角色`);
    }
  });

  ctx
    .command("pcremove [name] 移除登场角色")
    .alias("pcmv")
    .action(async ({ session }, name) => {
      if (!session) return "无法获取用户信息。";
      console.log(session.event.user, session.user);
      const user = session.event.user;
      const groupId = session.guildId;
      if (!name) {
        session.send("请输入角色名称");
        return;
      }
      const characterRemoveNow = await ctx.database.remove("playercharacter", {
        userid: user.id,
        groupid: groupId,
        useable: true,
        rolename: name,
      });
      if (!characterRemoveNow.matched) {
        const characterRemove = await ctx.database.remove("playercharacter", {
          userid: user.id,
          groupid: groupId,
          rolename: name,
        });
        if (!characterRemove.matched) {
          session.send(`${name} 不存在`);
          return;
        }
      } else {
        if (session.platform == "onebot") {
          const cardName = `${user.name}`;
          await session.onebot.setGroupCard(groupId, user.id, cardName);
        }
      }
      session.send(`${name} 在舞台上谢幕了`);
    });

  ctx
    .command("pcshow [name] 显示当前登场角色属性")
    .action(async ({ session }, name) => {
      if (!session) return "无法获取用户信息。";
      console.log(session.event.user, session.user);
      const user = session.event.user;
      const groupId = session.guildId;

      const character = await ctx.database
        .select("playercharacter")
        .where((row) => $.eq(row.userid, user.id))
        .where((row) => $.eq(row.groupid, groupId))
        .where((row) => $.eq(row.rolename, name))
        .execute();
      if (character.length == 0) {
        session.send(`${name || "角色"} 不存在`);
        return;
      }
      session.send(
        `[${character[0].rolename}] 属性如下：${JSON.stringify(character[0])}`,
      );
    });
}

async function switchRoles(ctx: Context, session: any, name: string) {
  const user = session.event.user;
  const groupId = session.guildId;

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
        groupid: groupId,
      },
      {
        useable: false,
      },
    );
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
