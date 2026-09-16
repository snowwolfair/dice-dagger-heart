import { Context } from "koishi";

declare module "koishi" {
  interface Tables {
    playercharacter: playerCharacter;
    groupstate: GroupState;
    dicelog: DiceLog;
    dicelogline: DiceLogLine;
    // character: Character;
    // field: Field;
  }
}

/** 群状态表：合并记录每个群的咕咕开关与当前规则集 */
export interface GroupState {
  id: number;
  groupid: string;
  enabled: boolean;
  rulename: string;
}

export interface playerCharacter {
  id: number;
  useable: boolean;
  userid: string;
  groupid: string;
  username: string;
  rolename: string;
  property: {
    agility: number;
    strength: number;
    finesse: number;
    instinct: number;
    presence: number;
    knowledge: number;
  };
  armor: {
    value: number;
    max: number;
  };
  hp: {
    value: number;
    max: number;
  };
  stress: {
    value: number;
    max: number;
  };
  hope: {
    value: number;
    max: number;
  };
  fear: {
    value: number;
    max: number;
  };
  major: number;
  severe: number;
  experience: string;
}

// // 角色卡表
// export interface Character {
//   id: number;
//   userid: string;
//   username: string;
//   rolename: string;
//   occupation: {
//     class: string;
//     subclass: string;
//   };
//   race: {
//     name: string;
//     characteristic: string[];
//   };
//   community: {
//     name: string;
//     characteristic: string;
//   };
//   property: {
//     agility: number;
//     strength: number;
//     finesse: number;
//     instinct: number;
//     presence: number;
//     knowledge: number;
//   };
//   evasion: number;
//   armor: {
//     name: string;
//     value: number;
//     max: number;
//   };
//   hp: {
//     value: number;
//     max: number;
//   };
//   stress: {
//     value: number;
//     max: number;
//   };
//   hope: {
//     value: number;
//     max: number;
//   };
//   primaryweapons: string;
//   secondaryweapons: string;
//   proficiency: {
//     value: number;
//     max: number;
//   };
//   backpack: string[];
//   background: string;
//   experience: string[];
//   field: string[];
// }

// // 领域卡表
// export interface Field {
//   id: number;
//   fieldtype: string;
//   name: string;
//   level: number;
//   remenbercost: number;
//   type: string;
//   characteristic: string[];
// }

export async function createPlayerCharacterTable(ctx: Context) {
  ctx.model.extend(
    "playercharacter",
    {
      id: "unsigned",
      useable: {
        type: "boolean",
        initial: false,
        nullable: false,
      },
      userid: "string",
      username: "string",
      groupid: "string",
      rolename: "string",
      "property.agility": "integer",
      "property.strength": "integer",
      "property.finesse": "integer",
      "property.instinct": "integer",
      "property.presence": "integer",
      "property.knowledge": "integer",
      "armor.value": "integer",
      "armor.max": "integer",
      "hp.value": {
        type: "integer",
        initial: 0,
        nullable: false,
      },
      "hp.max": {
        type: "integer",
        initial: 6,
        nullable: false,
      },
      "stress.value": {
        type: "integer",
        initial: 0,
        nullable: false,
      },
      "stress.max": {
        type: "integer",
        initial: 6,
        nullable: false,
      },
      "hope.value": {
        type: "integer",
        initial: 2,
        nullable: false,
      },
      "hope.max": {
        type: "integer",
        initial: 6,
        nullable: false,
      },
      "fear.value": {
        type: "integer",
        initial: 0,
        nullable: false,
      },
      "fear.max": {
        type: "integer",
        initial: 12,
        nullable: false,
      },
      major: "integer",
      severe: "integer",
      experience: {
        type: "string",
        initial: "",
        nullable: false,
      },
    },
    { autoInc: true },
  );
}

/** 建立群状态表：groupid 唯一，合并记录咕咕开关与当前规则集 */
export async function createGroupStateTable(ctx: Context) {
  ctx.model.extend("groupstate", {
    id: "unsigned",
    groupid: "string",
    enabled: {
      type: "boolean",
      initial: true,
      nullable: false,
    },
    rulename: {
      type: "string",
      initial: "DH",
      nullable: false,
    },
  }, {
    autoInc: true,
    primary: "id",
    unique: ["groupid"],
  });
}

// ==================== 跑团日志表 ====================

/** 日志会话状态：recording=记录中, paused=暂停, ended=已结束 */
export type LogStatus = "recording" | "paused" | "ended";

/** 日志会话表：一个群可同时有一个活跃会话 */
export interface DiceLog {
  id: number;
  groupid: string;
  logname: string;
  userid: string;
  status: string;  // LogStatus
  starttime: number;
  endtime: number;
}

/** 日志条目表：记录会话期间每条消息（玩家发言、机器人回复、系统事件、OOC） */
export interface DiceLogLine {
  id: number;
  groupid: string;
  logname: string;
  username: string;    // 发送者名称
  userid: string;      // 发送者平台 ID（如 QQ 号）
  content: string;     // 消息纯文本内容
  timestamp: number;
  type: string;  // "player" | "result" | "system" | "ooc"
}

/** 建立日志会话表 */
export async function createDiceLogTable(ctx: Context) {
  ctx.model.extend("dicelog", {
    id: "unsigned",
    groupid: "string",
    logname: "string",
    userid: "string",
    status: {
      type: "string",
      initial: "recording",
      nullable: false,
    },
    starttime: {
      type: "integer",
      initial: 0,
      nullable: false,
    },
    endtime: {
      type: "integer",
      initial: 0,
      nullable: false,
    },
  }, {
    autoInc: true,
    primary: "id",
  });
}

/** 建立日志条目表 */
export async function createDiceLogLineTable(ctx: Context) {
  ctx.model.extend("dicelogline", {
    id: "unsigned",
    groupid: "string",
    logname: "string",
    username: {
      type: "string",
      initial: "",
      nullable: false,
    },
    userid: {
      type: "string",
      initial: "",
      nullable: false,
    },
    content: {
      type: "text",
      nullable: false,
    },
    timestamp: {
      type: "integer",
      initial: 0,
      nullable: false,
    },
    type: {
      type: "string",
      initial: "result",
      nullable: false,
    },
  }, {
    autoInc: true,
    primary: "id",
  });
}

// export async function createFieldTable(ctx: Context) {
//   ctx.model.extend("field", {
//     id: "unsigned",
//     fieldtype: "string",
//     name: "string",
//     level: "integer",
//     remenbercost: "integer",
//     type: "string",
//     characteristic: "list",
//   });

//   await ctx.database.upsert(
//     "field",
//     [
//       {
//         fieldtype: "bone",
//         name: "森林",
//         level: 1,
//         remenbercost: 1,
//         type: "自然",
//         characteristic: ["自然", "开放"],
//       },
//       {
//         fieldtype: "bone",
//         name: "沙漠",
//         level: 1,
//         remenbercost: 1,
//         type: "自然",
//         characteristic: ["自然", "封闭"],
//       },
//     ],
//     "name"
//   );
// }

// export function createCharacterTable(ctx: Context) {
//   ctx.model.extend(
//     "character",
//     {
//       // 各字段的类型声明
//       id: "unsigned",
//       userid: "string",
//       username: "string",
//       rolename: "string",
//       "occupation.class": "string",
//       "occupation.subclass": "string",
//       "race.name": "string",
//       "race.characteristic": "list",
//       "community.name": "string",
//       "community.characteristic": "string",
//       "property.agility": "integer",
//       "property.strength": "integer",
//       "property.finesse": "integer",
//       "property.instinct": "integer",
//       "property.presence": "integer",
//       "property.knowledge": "integer",
//       evasion: "integer",
//       "armor.name": "string",
//       "armor.value": "integer",
//       "armor.max": "integer",
//       "hp.value": {
//         type: "integer",
//         initial: 0,
//         nullable: false,
//       },
//       "hp.max": {
//         type: "integer",
//         initial: 6,
//         nullable: false,
//       },
//       "stress.value": {
//         type: "integer",
//         initial: 0,
//         nullable: false,
//       },
//       "stress.max": {
//         type: "integer",
//         initial: 6,
//         nullable: false,
//       },
//       "hope.value": {
//         type: "integer",
//         initial: 2,
//         nullable: false,
//       },
//       "hope.max": {
//         type: "integer",
//         initial: 6,
//         nullable: false,
//       },
//       primaryweapons: "string",
//       secondaryweapons: "string",
//       "proficiency.value": {
//         type: "integer",
//         initial: 1,
//         nullable: false,
//       },
//       "proficiency.max": {
//         type: "integer",
//         initial: 6,
//         nullable: false,
//       },
//       backpack: "list",
//       background: "string",
//       experience: "list",
//       field: "list",
//     },
//     {
//       primary: "id",
//       autoInc: true,
//     }
//   );
// }
