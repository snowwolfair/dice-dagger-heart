import { Context, Database, Schema } from "koishi";

export const name = "dice-dagger-heart";

export const inject = ["database"];

declare module "koishi" {
  interface Tables {
    character: Character;
    field: Field;
  }
}

export interface Character {
  id: number;
  userid: string;
  username: string;
  rolename: string;
  occupation: {
    class: string;
    subclass: string;
  };
  race: {
    name: string;
    characteristic: string[];
  };
  community: {
    name: string;
    characteristic: string;
  };
  property: {
    agility: number;
    strength: number;
    finesse: number;
    instinct: number;
    presence: number;
    knowledge: number;
  };
  evasion: number;
  armor: {
    name: string;
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
  primaryweapons: string;
  secondaryweapons: string;
  proficiency: {
    value: number;
    max: number;
  };
  backpack: string[];
  background: string;
  experience: string[];
  field: string[];
}

export interface Field {
  id: number;
  fieldtype: string;
  name: string;
  level: number;
  remenbercost: number;
  type: string;
  characteristic: string[];
}

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export async function apply(ctx: Context, config: Config) {
  // write your plugin here
  ctx.model.extend("character", {
    // 各字段的类型声明
    id: "unsigned",
    userid: "string",
    username: "string",
    rolename: "string",
    "occupation.class": "string",
    "occupation.subclass": "string",
    "race.name": "string",
    "race.characteristic": "list",
    "community.name": "string",
    "community.characteristic": "string",
    "property.agility": "integer",
    "property.strength": "integer",
    "property.finesse": "integer",
    "property.instinct": "integer",
    "property.presence": "integer",
    "property.knowledge": "integer",
    evasion: "integer",
    "armor.name": "string",
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
    primaryweapons: "string",
    secondaryweapons: "string",
    "proficiency.value": {
      type: "integer",
      initial: 1,
      nullable: false,
    },
    "proficiency.max": {
      type: "integer",
      initial: 6,
      nullable: false,
    },
    backpack: "list",
    background: "string",
    experience: "list",
    field: "list",
  });

  ctx.model.extend("field", {
    id: "unsigned",
    fieldtype: "string",
    name: "string",
    level: "integer",
    remenbercost: "integer",
    type: "string",
    characteristic: "list",
  });

  // await ctx.database.upsert("field", [
  //   {
  //     fieldtype: "bone",
  //     name: "森林",
  //     level: 1,
  //     remenbercost: 1,
  //     type: "自然",
  //     characteristic: ["自然", "开放"],
  //   },
  // ]);

  ctx.command("dice").action(async ({ session }) => {
    if (!session.user) return "无法获取用户信息。";
  });

  ctx
    .command("diceadd <rolename> <occupationClass>")
    .action(async ({ session }, rolename, occupationClass) => {
      if (!session.user) return "无法获取用户信息。";
      let temp = ctx.database.get("character", { rolename: rolename });

      if (temp[0] && rolename == temp[0].rolename) {
        return "不能给自己添加角色。";
      } else {
        session.send(`创建角色${rolename}成功！`);
      }
    });
}
