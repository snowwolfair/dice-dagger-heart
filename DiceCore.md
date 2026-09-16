# DiceCore 基底插件使用说明

> 版本：1.5.1
> 适用于：希望开发基于 Daggerheart 二元骰机制的其他规则集插件的开发者

## 概述

本插件（`dice-dagger-heart`）作为**基底插件**，提供可复用的二元骰（duality dice）系统。其他规则集可作为独立插件接入，复用 `.dd`/`.ddr` 指令的整套机制，只需提供配置即可。

### 核心特性

- **指令复用**：`.dd`/`.ddr` 中间件由基底自动注册，扩展插件无需重复编写掷骰逻辑
- **规则路由**：同一指令根据当前群规则自动路由到对应规则的中间件
- **守卫统一**：gugu 开关与规则匹配由基底中间件处理，扩展命令只需调用 `ctx.diceCore.ensureRule`
- **配置化**：骰子面数、资源字段、文案、属性字典等全部参数化
- **可扩展**：支持标准资源变化（声明式）与自定义钩子（编程式）两种模式

---

## 架构

```
基底插件 dice-dagger-heart
├── ctx.diceCore 服务（扩展插件通过此接入）
│   ├── registerRule(rule)           注册规则集
│   ├── registerDiceSystem(ctx, cfg) 注册二元骰系统
│   ├── ensureRule(session, key)     规则守卫
│   └── ensureEnabled(session)       gugu 守卫
├── 通用掷骰（r / .r，所有规则可用）
├── DH 规则（默认内置，作为示范配置注册）
└── 命令守卫中间件（统一处理 gugu + cook 规则路由）

扩展插件 dice-xxx（独立 npm 包）
├── ctx.diceCore.registerRule()      注册自己的规则集
├── ctx.diceCore.registerDiceSystem() 注册二元骰配置
├── 自己的角色卡表（表名自定义）
└── 自己的角色卡命令（守卫复用 ctx.diceCore.ensureRule）
```

### 指令路由机制

多个规则都注册 `.dd` 中间件，每个中间件内部先检查"当前群规则是否匹配我"，不匹配就 `next()` 放行，匹配则执行并吞掉事件：

```
.dd 消息进入
  → 规则A的.dd中间件: currentRule === "A"? 否 → next()
  → 规则B的.dd中间件: currentRule === "B"? 是 → 执行 → return(吞掉)
  → 规则C的.dd中间件: 收不到事件（已被吞）
```

---

## 快速开始

### 1. 创建扩展插件

```bash
# 在 Koishi 插件市场中创建新插件，或手动初始化
npm init -y
# peerDependencies 需要声明依赖基底插件
```

在 `package.json` 中声明：

```json
{
  "name": "dice-light-shadow",
  "peerDependencies": {
    "koishi": "^4.18.7",
    "koishi-plugin-dice-dagger-heart": "^1.5.0"
  }
}
```

### 2. 最小可用示例

```typescript
// src/index.ts
import { Context } from "koishi";

export const name = "dice-light-shadow";

export function apply(ctx: Context) {
  // 1. 注册规则集
  ctx.diceCore.registerRule({
    key: "LS",
    name: "光明与阴影",
    aliases: ["LS", "光明", "light-shadow"],
    description: "光明/阴影二元骰系统",
  });

  // 2. 建自己的角色卡表
  ctx.model.extend("ls_character", {
    id: "unsigned",
    groupid: "string",
    userid: "string",
    rolename: "string",
    useable: "boolean",
    light: { value: "integer", max: "integer" },
    shadow: { value: "integer", max: "integer" },
  }, { autoInc: true, primary: "id" });

  // 3. 注册二元骰系统（复用 .dd/.ddr 中间件，只换配置）
  ctx.diceCore.registerDiceSystem(ctx, {
    ruleKey: "LS",
    diceSides: 12,
    positiveDieName: "光明骰",
    negativeDieName: "阴影骰",
    outcomes: {
      positive: {
        label: "光明结果",
        quotes: ["光明降临", "希望闪耀"],
        showTotal: true,
        resources: [
          { target: "player", field: "light", direction: 1, cap: 6,
            displayLabel: "[光明值变化]", defaultValue: 2, capLabel: "6(已满)" },
        ],
      },
      negative: {
        label: "阴影结果",
        quotes: ["阴影蔓延", "黑暗低语"],
        showTotal: true,
        resources: [
          { target: "gm", field: "shadow", direction: 1, cap: 12,
            displayLabel: "[阴影值变化]", defaultValue: 0, capLabel: "12(已满)" },
        ],
      },
      critical: {
        label: "平衡突破！",
        quotes: ["光暗交织，奇迹诞生"],
        showTotal: false,
        resources: [
          { target: "player", field: "light", direction: 1, cap: 6,
            displayLabel: "[光明值变化]", defaultValue: 2, capLabel: "6(已满)" },
        ],
      },
    },
    propertyDict: { "力量": "strength", "敏捷": "agility" },
    characterTable: "ls_character",
    gmRoleName: "暗影主宰",
    buildCardName: (char) => `${char.rolename} 光明${char.light.value}/${char.light.max}`,
  });

  // 4. 注册规则专属命令（推荐：ruleCommand 自动守卫）
  ctx.diceCore.ruleCommand(ctx, "LS", "lsnew [name] 创建光明角色", async (argv, name) => {
    const { session } = argv;
    if (!name) return session.send("请输入角色名称");
    // ...创建角色逻辑
    session.send(`新人登场！${name}进入了光与影的世界`);
  });
  // setrule 切换到 DH 后，lsnew 命令会自动失效
}
```

### 3. 用户侧使用

```
群内输入：setrule LS          → 切换到光明与阴影规则
群内输入：.dd                  → 光明骰 7  阴影骰 3 → 光明结果
群内输入：lsnew 艾莉丝        → 新人登场！艾莉丝进入了光与影的世界
群内输入：setrule DH           → 切回匕首之心
群内输入：lsnew 测试           → 无响应（lsnew 是 LS 规则专属，已自动失效）
```

---

## API 参考

### `ctx.diceCore.registerRule(rule)`

注册一个规则集，使其可被 `setrule` 切换。

| 参数 | 类型 | 说明 |
|------|------|------|
| `rule.key` | `string` | 规则唯一标识（如 `"DH"`、`"LS"`），与 `DiceSystemConfig.ruleKey` 对应 |
| `rule.name` | `string` | 显示名称（如"匕首之心"） |
| `rule.aliases` | `string[]` | 别名列表，`setrule` 时可用任意别名切换 |
| `rule.description` | `string` | 规则简介 |

**注意**：`key` 重复时会抛错。基底启动时已注册 `"DH"`，扩展插件不可使用此 key。

### `ctx.diceCore.registerDiceSystem(ctx, config)`

注册二元骰系统，自动注册带规则路由的 `.dd`/`.ddr` 中间件。

#### `DiceSystemConfig` 完整字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `ruleKey` | `string` | 所属规则 key，必须与 `registerRule` 的 key 一致 |
| `diceSides` | `number` | 骰子面数（DH=12） |
| `positiveDieName` | `string` | 正面骰显示名（如"希望骰"） |
| `negativeDieName` | `string` | 负面骰显示名（如"恐惧骰"） |
| `outcomes` | `object` | 三种结果配置，见下方 |
| `propertyDict` | `Record<string, string>` | 中文属性名 → 数据库字段映射 |
| `proConDict?` | `Record<string, string>` | 优势/劣势映射（可选） |
| `characterTable` | `string` | 角色卡数据库表名 |
| `gmRoleName` | `string` | GM 角色名（DH="GM"） |
| `buildCardName` | `(char) => string` | 构建群名片文本的函数 |

#### `outcomes` 配置

```typescript
outcomes: {
  positive: OutcomeConfig;  // 正面骰 > 负面骰
  negative: OutcomeConfig;  // 正面骰 < 负面骰
  critical:  OutcomeConfig;  // 正面骰 === 负面骰
}
```

#### `OutcomeConfig` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 结果标签（如"希望结果"） |
| `quotes` | `string[]` | 命运寄语池，掷骰时随机抽取一句 |
| `showTotal` | `boolean` | 是否在消息中显示合计值 |
| `resources` | `ResourceChange[]` | 标准资源变化列表 |
| `customUpdate?` | `(params) => Promise<void>` | 自定义资源更新钩子（可选） |
| `customDisplay?` | `(params) => Promise<string>` | 自定义变化行显示钩子（可选） |

#### `ResourceChange` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `target` | `"player" \| "gm"` | 更新谁的角色卡 |
| `field` | `string` | 数据库字段路径（如 `"hope"`） |
| `direction` | `1 \| -1` | 变化方向 |
| `cap` | `number` | 上限（direction=1）或下限（direction=-1） |
| `displayLabel` | `string` | 消息中的标签（如"[希望值变化]"） |
| `defaultValue` | `number` | 无角色时的默认显示值 |
| `capLabel` | `string` | 触顶/触底时的显示文本（如"6(已满)"） |

### `ctx.diceCore.ensureRule(session, ruleKey)`

规则守卫，当前群规则 === `ruleKey` 时返回 `true`。用于扩展插件自己的命令中：

```typescript
ctx.command("lsnew [name] 创建光明角色").action(async ({ session }, name) => {
  if (!(await ctx.diceCore.ensureRule(session, "LS"))) return;
  if (!(await ctx.diceCore.ensureEnabled(session))) return;
  // ...命令逻辑
});
```

### `ctx.diceCore.ensureEnabled(session)`

gugu 守卫，群开关启用时返回 `true`。

### `ctx.diceCore.ruleCommand(ctx, ruleKey, decl, action)`

**推荐**：注册规则专属命令的便捷函数，自动包裹 gugu + 规则守卫。非当前规则时静默不响应，无需手动调用 `ensureRule`/`ensureEnabled`。

| 参数 | 类型 | 说明 |
|------|------|------|
| `ctx` | `Context` | Koishi 上下文 |
| `ruleKey` | `string` | 命令所属规则 key，与 `registerRule` 的 key 一致 |
| `decl` | `string` | 命令声明，与 `ctx.command(decl)` 参数一致，如 `"lsnew [name] 创建光明角色"` |
| `action` | `(argv, ...args) => any` | 命令处理函数，签名与 `Command.action` 一致 |

**与 `ctx.command` 的关系**：`ruleCommand` 是 `ctx.command(decl).action(action)` 的守卫增强版，自动在 action 前检查：
1. `session` 是否存在
2. gugu 是否启用（`ensureEnabled`）
3. 当前群规则是否 === `ruleKey`（`ensureRule`）

任一检查不通过则直接 `return`（静默不响应），不执行 action。

**适用场景**：所有 `ctx.command` 形式的规则专属命令。

**不适用场景**：中间件形式的命令（如 DH 的 `st` 属性录入，通过前缀匹配触发），此类需手动调用 `ensureRule`。

#### 用法对比

```typescript
// ✅ 推荐：ruleCommand 自动守卫
ctx.diceCore.ruleCommand(ctx, "LS", "lsnew [name] 创建光明角色", async (argv, name) => {
  const { session } = argv;
  // action 内部无需写守卫代码
  // 非当前规则时此函数不会被调用
  if (!name) return session.send("请输入角色名称");
  // ...命令逻辑
});

// ⚠️ 旧方式：手动守卫（容易遗漏）
ctx.command("lsnew [name] 创建光明角色").action(async ({ session }, name) => {
  if (!(await ctx.diceCore.ensureEnabled(session))) return;  // 容易忘
  if (!(await ctx.diceCore.ensureRule(session, "LS"))) return;  // 容易忘
  // ...命令逻辑
});
```

#### 完整示例

```typescript
// 创建角色命令
ctx.diceCore.ruleCommand(ctx, "LS", "lsnew [name] 创建光明角色", async (argv, name) => {
  const { session } = argv;
  if (!name) return session.send("请输入角色名称");

  // 旧角色谢幕
  await ctx.database.set("ls_character",
    { userid: session.userId, groupid: session.guildId, useable: true },
    { useable: false });

  // 创建新角色
  await ctx.database.create("ls_character", {
    userid: session.userId,
    groupid: session.guildId,
    rolename: name,
    useable: true,
    light: { value: 0, max: 0 },
    shadow: { value: 0, max: 0 },
    strength: 0,
    agility: 0,
  });

  session.send(`新人登场！${name}进入了光与影的世界`);
});

// 切换角色命令
ctx.diceCore.ruleCommand(ctx, "LS", "lsswitch [name] 切换角色", async (argv, name) => {
  const { session } = argv;
  // ...切换逻辑
});
```

---

## 标准模式 vs 自定义钩子

### 标准模式（声明式，覆盖 80% 场景）

适用于"固定字段 + 固定方向 + 固定 cap"的资源变化：

```typescript
outcomes: {
  positive: {
    label: "希望结果",
    quotes: [...],
    showTotal: true,
    resources: [
      { target: "player", field: "hope", direction: 1, cap: 6,
        displayLabel: "[希望值变化]", defaultValue: 2, capLabel: "6(已满)" },
      // 希望结果同时加生命值（多个资源变化）
      { target: "player", field: "hp", direction: 1, cap: 20,
        displayLabel: "[生命值变化]", defaultValue: 10, capLabel: "20(已满)" },
    ],
  },
}
```

### 自定义钩子（编程式，处理复杂逻辑）

适用于标准模式无法表达的场景：

| 场景 | 用什么 |
|------|--------|
| 生命低于一半时希望额外+1 | `customUpdate` |
| 恢复等于骰点数的生命 | `customUpdate` |
| 更新经验表（非角色卡表） | `customUpdate` |
| 变化行显示动态文本 | `customDisplay` |

```typescript
outcomes: {
  positive: {
    label: "希望结果",
    quotes: [...],
    showTotal: true,
    resources: [
      // 标准变化：希望 +1
      { target: "player", field: "hope", direction: 1, cap: 6,
        displayLabel: "[希望值变化]", defaultValue: 2, capLabel: "6(已满)" },
    ],
    // 自定义逻辑：生命低于一半时额外恢复1点
    customUpdate: async ({ ctx, session, character }) => {
      if (character.length === 0) return;
      if (character[0].hp.value < character[0].hp.max / 2) {
        await ctx.database.set("xx_character",
          { userid: session.userId, useable: true },
          (row) => ({ "hp.value": $.min([$.add(row.hp.value, 1), row.hp.max]) }),
        );
      }
    },
    customDisplay: async ({ character }) => {
      if (character.length === 0) return "";
      if (character[0].hp.value < character[0].hp.max / 2) {
        return "[生命值变化]: 额外恢复1点";
      }
      return "";
    },
  },
}
```

### 执行顺序

```
rollResult() 流程：
  1. 判定结果类型（positive / negative / critical）
  2. 取出 outcome = config.outcomes[key]
  3. 解析调整值（用 config.propertyDict）
  4. 非反应掷骰时：
     a. applyOutcomeUpdates:
        - 遍历 outcome.resources → applyStandardChange (固定字段+cap)
        - 若 outcome.customUpdate → 调用钩子 (自定义逻辑)
     b. 若 negative 结果且有 GM → 更新 GM 群名片
  5. formatChangeLines:
     a. 遍历 outcome.resources → formatStandardChange (X->Y / capLabel)
     b. 若 outcome.customDisplay → 调用钩子，追加返回的文本
  6. 拼接消息（adjustStr + changeLine + totalLine + quote）
```

---

## 角色卡表设计建议

扩展插件应建自己的角色卡表，表名自定义（不与 DH 的 `playercharacter` 冲突）：

```typescript
ctx.model.extend("ls_character", {
  id: "unsigned",
  groupid: "string",
  userid: "string",
  rolename: "string",
  useable: "boolean",
  // 资源字段（与 ResourceChange.field 对应）
  light: { value: "integer", max: "integer" },
  shadow: { value: "integer", max: "integer" },
  // 属性字段（与 propertyDict 的值对应）
  strength: "integer",
  agility: "integer",
}, {
  autoInc: true,
  primary: "id",
  unique: ["groupid", "userid", "rolename"],
});
```

**关键字段约定**：
- `userid` / `groupid` / `useable`：基底中间件依赖这三个字段定位当前登场角色
- `rolename`：GM 角色通过 `rolename === config.gmRoleName` 定位
- 资源字段结构：`{ value: number, max: number }`（与 `ResourceChange.field` 配合）
- 属性字段：扁平的 number 字段，通过 `propertyDict` 映射中文输入

---

## 完整扩展插件示例

以下展示一个包含角色卡命令的完整扩展插件：

```typescript
// dice-light-shadow/src/index.ts
import { Context, $ } from "koishi";

export const name = "dice-light-shadow";

export function apply(ctx: Context) {
  // ===== 1. 注册规则集 =====
  ctx.diceCore.registerRule({
    key: "LS",
    name: "光明与阴影",
    aliases: ["LS", "光明", "light-shadow"],
    description: "光明/阴影二元骰系统",
  });

  // ===== 2. 建角色卡表 =====
  ctx.model.extend("ls_character", {
    id: "unsigned",
    groupid: "string",
    userid: "string",
    rolename: "string",
    useable: "boolean",
    light: { value: "integer", max: "integer" },
    shadow: { value: "integer", max: "integer" },
    strength: "integer",
    agility: "integer",
  }, { autoInc: true, primary: "id", unique: ["groupid", "userid", "rolename"] });

  // ===== 3. 注册二元骰系统 =====
  ctx.diceCore.registerDiceSystem(ctx, {
    ruleKey: "LS",
    diceSides: 12,
    positiveDieName: "光明骰",
    negativeDieName: "阴影骰",
    outcomes: {
      positive: {
        label: "光明结果",
        quotes: ["光明降临", "希望闪耀"],
        showTotal: true,
        resources: [
          { target: "player", field: "light", direction: 1, cap: 6,
            displayLabel: "[光明值变化]", defaultValue: 2, capLabel: "6(已满)" },
        ],
      },
      negative: {
        label: "阴影结果",
        quotes: ["阴影蔓延", "黑暗低语"],
        showTotal: true,
        resources: [
          { target: "gm", field: "shadow", direction: 1, cap: 12,
            displayLabel: "[阴影值变化]", defaultValue: 0, capLabel: "12(已满)" },
        ],
      },
      critical: {
        label: "平衡突破！",
        quotes: ["光暗交织，奇迹诞生"],
        showTotal: false,
        resources: [
          { target: "player", field: "light", direction: 1, cap: 6,
            displayLabel: "[光明值变化]", defaultValue: 2, capLabel: "6(已满)" },
        ],
      },
    },
    propertyDict: { "力量": "strength", "敏捷": "agility" },
    characterTable: "ls_character",
    gmRoleName: "暗影主宰",
    buildCardName: (char) => {
      if (char.rolename === "暗影主宰") {
        return `${char.username} 阴影${char.shadow.value}/${char.shadow.max}`;
      }
      return `${char.rolename} 光明${char.light.value}/${char.light.max}`;
    },
  });

  // ===== 4. 角色卡命令（推荐：ruleCommand 自动守卫） =====
  ctx.diceCore.ruleCommand(ctx, "LS", "lsnew [name] 创建光明角色", async (argv, name) => {
    const { session } = argv;
    if (!name) return session.send("请输入角色名称");

    // 旧角色谢幕
    await ctx.database.set("ls_character",
      { userid: session.userId, groupid: session.guildId, useable: true },
      { useable: false });

    // 创建新角色
    await ctx.database.create("ls_character", {
      userid: session.userId,
      groupid: session.guildId,
      rolename: name,
      useable: true,
      light: { value: 0, max: 0 },
      shadow: { value: 0, max: 0 },
      strength: 0,
      agility: 0,
    });

    session.send(`新人登场！${name}进入了光与影的世界`);
  });
}
```

---

## 内置指令与守卫规则

### 基底内置指令

| 指令 | 归属 | 守卫规则 |
|------|------|---------|
| `r` / `.r` | 通用掷骰 | 仅受 gugu 控制，所有规则可用 |
| `gugu on/off/leave` | 基底 | 始终可用，不受 gugu/规则限制 |
| `setrule [name]` | 基底 | 始终可用，不受 gugu/规则限制 |
| `.dd` / `.ddr` | 各规则的 `registerDiceSystem` | 由各规则中间件自行做规则路由 + gugu 守卫 |
| `cook` | DH 专属 | gugu + 规则必须为 DH |
| `pcnew`/`gm`/`pcswitch`/`st`/`pcpc`/`pclist`/`pcremove`/`pcshow` | DH 专属 | 每条命令内部调用 `ensureRule(ctx, session, "DH")` |
| `showplayer` | DH 专属 | gugu + 规则必须为 DH |

### 扩展插件命令

扩展插件通过 `ctx.diceCore.ruleCommand` 注册的命令会**自动**受 gugu + 规则守卫保护，非当前规则时静默不响应：

| 注册方式 | 守卫行为 |
|---------|---------|
| `ctx.diceCore.ruleCommand(ctx, key, decl, action)` | 自动检查 gugu + 规则（推荐） |
| `ctx.command(decl).action(action)` + 手动 `ensureRule`/`ensureEnabled` | 需自行调用守卫（容易遗漏） |
| 中间件形式（`ctx.middleware`） | 需在中间件内部手动调用 `ensureRule`（如 DH 的 `st`） |

**结论**：使用 `ruleCommand` 注册的命令，在 `setrule` 切换规则后会自动失效，无需额外处理。

### 私聊行为

私聊时 `session.guildId` 为 `undefined`，无法查询 `groupstate`，默认放行：
- `r`/`.r`：正常可用（不依赖群）
- `.dd`/`.ddr`：可用，但因查不到角色，资源更新与变化行按默认值显示，不修改数据库
- gugu 守卫在私聊不生效（符合"gugu 是群开关"的语义）

### 未注册群默认

- `enabled`：默认 `true`（gugu 放行）
- `rulename`：默认 `"DH"`（DH 指令可用）

如需改为"未注册群默认不响应"，修改 `commandGugu.ts` 的 `isGroupEnabled` 与 `commandRule.ts` 的 `getCurrentRule` 的空数组分支即可。

---

## 文件结构

```
src/
├── index.ts              # 插件入口：挂载 ctx.diceCore + 注册 DH 配置
├── types.ts              # DiceCore 接口定义与配置类型
├── diceCore.ts           # 参数化二元骰核心（registerDiceSystem）
├── config.ts             # 配置 schema（命运寄语文案，未实际使用）
├── pathway.ts            # 模板路径解析
├── commands/
│   ├── commandDice.ts     # 通用掷骰入口 + 统一守卫中间件
│   ├── commandDHDice.ts   # DH 专属（cook 烹饪）
│   ├── commandCreateRole.ts  # DH 角色卡管理
│   ├── commandBoard.ts   # 人物卡图片渲染
│   ├── commandGugu.ts    # gugu 开关命令 + ensureEnabled
│   └── commandRule.ts    # setrule 命令 + ensureRule
└── utiles/
    ├── database.ts       # 数据表定义（playercharacter + groupstate）
    ├── dict.ts           # DH 中英属性/味道映射字典
    └── rules.ts          # 规则注册中心（registerRule）
```

---

## 常见问题

### Q: 扩展插件和基底插件的加载顺序有要求吗？

没有严格要求。基底 `apply` 执行时挂载 `ctx.diceCore`，扩展插件 `apply` 调用 `ctx.diceCore.*` 时如果服务已挂载即可正常工作。Koishi 的插件系统会保证依赖注入完成后再调用 `apply`。

### Q: 多个规则都注册了 `.dd`，会冲突吗？

不会。每个规则的 `.dd` 中间件内部先检查 `currentRule === config.ruleKey`，不匹配就 `next()` 放行给下一个中间件。只有当前群规则对应的那个中间件会真正执行并吞掉事件。

### Q: 扩展插件需要自己处理 `.ddr` 的"反应掷骰不修改资源"吗？

不需要。基底 `registerDiceSystem` 内部已经处理：`.ddr` 中间件匹配后直接 `return` 吞掉事件，且 `rollResult` 的 `isPrepend=true` 分支会跳过 `applyOutcomeUpdates`。

### Q: 扩展插件的角色卡表字段结构有要求吗？

有。基底中间件依赖以下字段定位角色：
- `userid` / `groupid` / `useable`：查询当前登场角色
- `rolename`：通过 `=== config.gmRoleName` 定位 GM
- 资源字段：必须是 `{ value: number, max: number }` 结构（`ResourceChange.field` 指向的字段）
- 属性字段：扁平的 number 字段，通过 `propertyDict` 映射

### Q: 如何让扩展插件的角色卡命令也像 DH 那样自动改群名片？

参考 DH 的 `buildCardName` 实现，在 `config.buildCardName` 中返回名片文本。基底会在以下时机调用它：
- `.dd` 恐惧结果后更新 GM 名片

角色卡命令（`pcnew`/`pcswitch`/`st`）的名片更新由扩展插件自己实现，可参考 `commandCreateRole.ts` 的 `updateGroupCard` 函数。

### Q: `characterTable` 为什么用 `as any`？

Koishi 的数据库方法对表名有类型约束（`Keys<Tables>`），但扩展插件的表名是动态的，不在基底的类型定义中。使用 `as any` 绕过编译期检查，运行时由 Koishi 数据库自行校验表是否存在。

---

## 版本历史

- **1.5.1**：新增 `ruleCommand` 便捷注册函数（命令自动守卫）
- **1.5.0**：基底+扩展架构（DiceCore 服务）
- **1.4.x**：规则集系统（setrule）、gugu 开关、群名片联动
- **1.3.x**：掷骰重构（OUTCOMES 配置表）、`.ddr` 重复解析修复
- **1.2.x**：角色卡管理、图片渲染
- **1.1.x**：二元骰核心、烹饪机制
