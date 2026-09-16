# 变更日志

## \[1.7.4] - 2026-08-31

### 修复 - 掷骰结果未记录到日志

**根因**：所有掷骰指令的 `session.send()` 调用都缺少 `await`。log 中间件把 `session.send` 包裹为 async 函数（先发送消息，再写入数据库），但调用方没 await，导致包裹函数的数据库记录操作变成 fire-and-forget，在中间件链继续执行时可能来不及完成或出错被静默吞掉。

**改动**：

* [diceCore.ts](src/diceCore.ts)：`rollResult` 的 `session.send` 加 `await`；`parseAdjustments` 改为 async，3 处 `session.send` 加 `await`

* [commandDice.ts](src/commands/commandDice.ts)：`nomalRollResult` 改为 async，`session.send` 加 `await`，两处 `nomalRollResult` 调用加 `await`

## \[1.7.3] - 2026-08-31

### 修复 - log 命令重复发送消息 ID

**根因**：所有 handler 用 `return session.send(...)`，`session.send` 返回消息 ID（数字），Koishi 把返回值又当回复发了一遍。

**改动**：

* `handleStart`/`Pause`/`Resume`：改为 `return "文本"`（直接返回字符串，让 Koishi 发一次）

* `handleEnd`：改为 `await session.send(...); return;`（显式发送后返回 undefined）

* `default` 分支：同样改为 `return "文本"`

* `handleEnd` 全流程加 `ctx.logger.info("[log end] ...")` 日志，便于排查导出问题

## \[1.7.2] - 2026-08-28

### 新增 - log 导出后归档并清理数据库

**目的**：导出日志后在服务器保留归档副本，同时删除数据库中的记录，控制数据库体积。

**改动**：

* `handleEnd` 导出文件后，复制一份到 `data/logs/archive/{logname}_{时间戳}.txt`（带时间戳避免同名覆盖）

* 删除 `dicelogline` 表中该日志的所有条目

* 删除 `dicelog` 表中该日志会话记录

* 清理失败时仅 warn 不阻断导出

## \[1.7.0] - 2026-08-28

### 重构 - log 导出格式兼容海豹染色器 QQ 格式

**目的**：导出的 txt 文件可被海豹染色器（log.weizaima.com）等文字团 log 生成器复原。

**改动**：

* `dicelogline` 表新增 `username` 和 `userid` 字段

* 记录中间件分别存储 `username`/`userid`/`content`

* 机器人回复记录机器人名称和 ID

* `formatLogContent` 改为输出 QQ 格式：`名字(QQ号) 年/月/日 时:分:秒\n消息内容`

## \[1.6.6] - 2026-08-27

### 新增 - customRollDice 自定义掷骰钩子（残月状态支持）

**目的**：允许扩展规则根据角色状态动态修改骰面（如 Witchy 蚀痕≥3 时混乱骰变 D20）。

**修改文件**：

* [types.ts](file:///c:\workbench\koilish\koishi-plugin-dice-dagger-heart\external\dice-dagger-heart\src\types.ts#L47-L51) — `DiceSystemConfig` 新增 `customRollDice` 钩子字段

* [diceCore.ts](file:///c:\workbench\koilish\koishi-plugin-dice-dagger-heart\external\dice-dagger-heart\src\diceCore.ts#L29-L70) — `.dd/.ddr` 中间件改为调用 `doRollTwoDice()`，优先使用 `customRollDice` 返回值，否则走默认 `rollTwoDice`

**使用方式**：扩展插件在 `registerDiceSystem` 配置中传入 `customRollDice(ctx, session, config)`，返回 `[positive, negative]` 覆盖默认结果，返回 `undefined` 则走默认逻辑。

## \[1.6.5] - 2026-08-27

### 修复 - log end 导出文件被自身记录

**问题**：`log end` 发送导出文件时，`session.send` 仍被 log 中间件包裹，导致"发送文件"这个行为本身又被记入日志，出现额外的文件信息记录。

**修复**：`handleEnd` 发送文件前先恢复 `session.send` 为原始函数（通过中间件保存的 `_originalSend`），使 log end 的输出不再被记录。

## \[1.6.4] - 2026-08-27

### 修复 - 声明 diceCore 服务

**问题**：扩展插件通过 `inject.required: ['diceCore']` 声明依赖时，Koishi 报"必需服务：diceCore (未加载)"。

**根因**：`ctx.diceCore = { ... }` 直接赋值未声明服务名，Cordis 无法识别为服务。

**修复**：将 `ctx.diceCore = { ... }` 改为 `ctx.set("diceCore", { ... })`，通过 Cordis 的 `ctx.set()` 正确注册服务（内部调用 `provide()` 声明服务名），扩展插件可通过 `inject.required` 声明依赖。

### 修复 - 规则路由：未注册群放行所有规则导致重复掷骰

**问题**：`isRuleMatched` 在未注册群和私聊时返回 `true`（放行所有规则），导致多个规则的 `.dd` 中间件同时执行，产生重复掷骰。

**根因**：`if (rows.length === 0) return true` 未检查规则是否为默认规则。

**修复**：未注册群和私聊时仅放行默认规则（`DEFAULT_RULE_KEY = "DH"`），其他规则返回 `false`。使用 `.rule WY` 切换规则后，仅 WY 的 `.dd` 中间件执行。

## \[1.6.3] - 2026-08-24

### 修复 - 图片等富媒体消息记录丢失

**问题**：`contentToString` 只处理 text 和 at 元素，图片（showplayer 人物卡）、文件、语音、视频等类型记录为空字符串，导致日志中"发送了人物卡"的信息丢失。

**修复**：补充 image/img → `[图片]`、file → `[文件:名称]`、audio → `[语音]`、video → `[视频]`、quote → 忽略（避免引用消息重复记录）。

## \[1.6.2] - 2026-08-24

### 新增 - log 与 gugu 互斥保护

**log start 互斥**：已有活跃 log 会话（recording 或 paused）时，无法再执行 `log start`，需先 `log end` 结束当前会话。

**gugu off/leave 互斥**：群有活跃 log 会话时，无法执行 `gugu off` 或 `gugu leave`，需先 `log end` 结束日志记录后再关闭或退群。提示文案："当前有正在进行的日志记录，请先 log end 结束后再关闭咕咕"。

**实现**：commandLog.ts 导出 `hasActiveLog(ctx, groupId)` 函数，commandGugu.ts 在 off/leave 分支调用检查。

## \[1.6.1] - 2026-08-24

### 新增 - OOC 过滤 + log 命令受 gugu 管理

**OOC 识别**：玩家消息以 `(( ))` 或 `（（ ））` 包裹时识别为场外，记录为 `ooc` 类型，导出时带 `[OOC]` 前缀标记，与正式 IC（In Character）内容区分。

**gugu 守卫**：log 命令现在受 gugu 开关管理，群关闭时 `log start`/`log p`/`log r`/`log end` 均不响应。记录中间件本身不受 gugu 影响（只要已有 recording 会话就继续记录，即使期间 gugu 被关闭）。

## \[1.6.0] - 2026-08-24

### 新增 - 跑团日志系统

**目的**：支持跑团期间自动记录**所有聊天内容**（玩家发言 + 机器人回复），结束后导出为 txt 文件。

**新增命令**：

* `log start [名称]` - 开始记录日志会话

* `log p` - 暂停记录（pause）

* `log r` - 恢复记录（resume）

* `log end` - 结束并导出为 txt 文件

**自动记录机制**：log 处于 recording 状态时，通过 prepend 中间件记录所有消息：

* 玩家发送的消息（player 类型）：记录发送者昵称 + 消息内容

* 机器人回复（result 类型）：包裹 session.send，记录所有机器人输出

* log 命令本身不被记录

**新增数据表**：

* `dicelog` - 日志会话表（groupid/logname/status/starttime/endtime）

* `dicelogline` - 日志条目表（groupid/logname/content/timestamp/type）

**文件导出**：log end 时把所有条目格式化为带时间戳的文本，写入 `data/logs/` 目录，通过 `h.file` 发送。若平台不支持文件发送则回退到文本消息。

**特性**：log 命令始终可用，不受 gugu/规则限制。log 期间所有消息照常发送到群里，同时被记录。

## \[1.5.1] - 2026-08-24

### 新增 - ruleCommand 便捷注册函数

**目的**：扩展插件注册角色卡命令时无需手动调用 `ensureRule`/`ensureEnabled`，由 `ruleCommand` 自动包裹守卫，避免遗漏导致非当前规则下命令仍可响应。

**新增 API**：`ctx.diceCore.ruleCommand(ctx, ruleKey, decl, action)`

* 自动检查 gugu 开关与规则匹配

* 非当前规则时静默不响应（不执行 action）

* 用法与 `ctx.command(decl).action(action)` 一致，只是多了自动守卫

**编译验证**：`tsc --noEmit` 通过。

## \[1.5.0] - 2026-08-24

### 重构 - 基底+扩展架构（DiceCore 服务）

**目的**：将基底插件改造为可扩展的骰子核心，其他规则集可作为独立插件通过 `ctx.diceCore` 接入，复用二元骰机制而无需重复代码。

**新增文件**：

* `src/types.ts`：`DiceCoreService` 接口定义、`DiceSystemConfig` / `OutcomeConfig` / `ResourceChange` 等配置接口；通过 `declare module "koishi"` 扩展 `Context` 挂载 `diceCore` 服务

* `src/diceCore.ts`：参数化的二元骰核心，`registerDiceSystem(ctx, config)` 自动注册 `.dd`/`.ddr` 中间件，中间件内部做规则路由（`currentRule === config.ruleKey`）与 gugu 守卫；支持标准资源变化（`resources` 数组）与自定义钩子（`customUpdate`/`customDisplay`）

**改动**：

* `src/utiles/rules.ts`：`RULES` 从静态 const 改为可追加数组，新增 `registerRule(rule)` 函数供扩展插件注册新规则集，带 key 重复校验

* `src/index.ts`：`apply` 中挂载 `ctx.diceCore` 服务（`registerRule` / `registerDiceSystem` / `ensureRule` / `ensureEnabled`）；DH 自身作为一份 `DiceSystemConfig` 注册，不再是"特殊"的

* `src/commands/commandDHDice.ts`：移除二元骰（.dd/.ddr）相关代码，仅保留 `cook` 烹饪命令

* `src/commands/commandDice.ts`：统一守卫中间件不再检查 `.dd`/`.ddr`（已由 `registerDiceSystem` 内部规则路由处理），只检查 `r`/`.r`（通用）与 `cook`（DH 专属）

**扩展插件接入方式**：

1. `ctx.diceCore.registerRule(rule)` 注册规则集
2. `ctx.diceCore.registerDiceSystem(ctx, config)` 注册二元骰系统（复用 `.dd`/`.ddr` 中间件，只换配置）
3. `ctx.diceCore.ensureRule(session, key)` / `ensureEnabled(session)` 在自己的命令中做守卫

**数据兼容**：`playercharacter` 和 `groupstate` 表 schema 不变，现有数据无需迁移。

## \[1.4.2] - 2026-08-24

### 重构 - 掷骰入口拆分 + 统一守卫中间件

**目的**：将 `commandDice.ts` 拆分为通用入口（`commandDice.ts`）与 DH 专属实现（`commandDHDice.ts`），守卫逻辑集中到一处前置中间件，避免每条命令内部重复检查。

**结构调整**：

* `commandDice.ts`（通用入口）：注册 `r` 命令 + `.r` 中间件（所有规则可用），注册**统一守卫中间件**，调用 `registerDHDice`

* `commandDHDice.ts`（DH 专属）：注册 `cook`/`.dd`/`.ddr`，**内部无任何守卫代码**

**统一守卫中间件**（commandDice.ts）：

* 前置中间件（`prepend=true`），在所有 DH 中间件之前执行

* 一次查询 `groupstate` 表，同时判断 `enabled`（gugu 开关）和 `rulename`（规则集）

* DH 指令（`.dd`/`.ddr`/`cook`）：gugu 关闭或规则非 DH 时吞掉

* 通用指令（`r`/`.r`）：仅受 gugu 开关控制，所有规则可用

* 未注册群默认放行

**执行顺序保证**：先调用 `registerDHDice`（注册 `.ddr` prepend），再注册统一守卫（prepend），后 prepend 排在更前，确保守卫最先执行。

**改动文件**：

* 新增 [commandDHDice.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandDHDice.ts)：DH 二元骰 + 烹饪，无守卫

* [commandDice.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandDice.ts)：通用掷骰 + 统一守卫，调用 `registerDHDice`

* index.ts 无需改动（`commandDice` 接口不变）

## \[1.4.1] - 2026-08-24

### 重构 - 合并群状态表

**目的**：`gugustate`（咕咕开关）与 `rulestate`（规则集）均为 `groupid` 唯一的群配置状态，合并为单表 `groupstate`，减少表数量与维护成本，语义更内聚。

**变更内容**：

* 合并 `GuguState` + `RuleState` 接口为 `GroupState`（`groupid` / `enabled` / `rulename`）

* 合并 `createGuguStateTable` + `createRuleStateTable` 为 `createGroupStateTable`

* `isGroupEnabled`、`getCurrentRule`、`gugu on/off`、`setrule <name>` 的 upsert 全部改查 `groupstate` 表

* 守卫函数签名与调用方代码**零改动**（`ensureEnabled` / `ensureRule` 对外接口不变）

**行为一致性**：

* 未注册群仍默认 `enabled=true`、`rulename="DH"`

* `gugu on/off` 只更新 `enabled` 字段，`setrule` 只更新 `rulename` 字段，互不干扰

* 所有命令的守卫链行为完全不变

**改动文件**：

* [database.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/utiles/database.ts)：`GroupState` 接口 + `createGroupStateTable`

* [commandGugu.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandGugu.ts)：改查 `groupstate`

* [commandRule.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandRule.ts)：改查 `groupstate`

* [index.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/index.ts)：注册 `createGroupStateTable`

**数据迁移提示**：若数据库中已存在 `gugustate` / `rulestate` 旧表数据，合并后需手动迁移（新群无数据则按默认值生效，无影响）。

## \[1.4.0] - 2026-08-24

### 新增 - 规则集切换系统

**功能**：通过 `setrule [name]` 切换当前群使用的骰子规则集，每个规则集有独立的骰子指令与角色卡系统，切换后旧规则的指令静默不响应。

**新增命令**：

* `setrule` — 无参数显示当前规则与可用列表

* `setrule <名称>` — 切换规则集（支持别名，大小写不敏感）

* 未知规则名时提示并列出可用规则

**默认规则**：`DH`（匕首之心），别名支持 `DH`/`匕首之心`/`daggerheart`/`dagger heart`/`匕首之心`

**新增数据库表** **`rulestate`**：

* `groupid`（群号，唯一）

* `rulename`（规则集 key，默认 `DH`）

**规则守卫机制**：

* `setrule` 命令本身始终可用，不受 gugu 和规则限制

* 切换规则后，原规则的指令静默不响应（与 gugu 一致）

* 未注册群默认使用 `DH` 规则

**守卫覆盖范围**（全部归为 DH 规则）：

* 掷骰指令：`r`/`cook`/`.dd`/`.ddr`/`.r`

* 角色卡系统：`pcnew`/`gm`/`pcswitch`/`st`/`pcpc`/`pclist`/`pcremove`/`pcshow`

* 人物卡渲染：`showplayer`

**扩展方式**：新增规则集时，在 [rules.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/utiles/rules.ts) 的 `RULES` 数组追加定义，然后为新规则注册命令并加 `ensureRule(ctx, session, "规则key")` 守卫即可。

**改动文件**：

* 新增 [rules.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/utiles/rules.ts)（规则集注册中心：`RuleSet` 接口、`resolveRule`/`listRules`/`formatRuleList`）

* 新增 [commandRule.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandRule.ts)（`setrule` 命令 + `getCurrentRule`/`ensureRule` 守卫）

* [database.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/utiles/database.ts) 新增 `RuleState` 接口与 `createRuleStateTable`

* [index.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/index.ts) 注册 setrule 与建表

* [commandDice.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandDice.ts) 给掷骰命令加 `ensureRule("DH")`（5 处）

* [commandCreateRole.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandCreateRole.ts) 给角色卡命令加 `ensureRule("DH")`（8 处）

* [commandBoard.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandBoard.ts) 给 `showplayer` 加 `ensureRule("DH")`

## \[1.3.1] - 2026-08-24

### 新增 - `.dd` 恐惧结果联动 GM 群名片

**功能**：`.dd` 二元骰掷出恐惧结果（希望骰 < 恐惧骰）时，GM 恐惧值 +1 后自动更新 GM 的群名片，使恐惧计数实时可见。

**触发条件**：

* 非 `.ddr` 反应掷骰（反应掷骰不修改资源）

* 结果为恐惧（`hope < despair`）

* 群内存在已登场的 GM 角色

* 平台为 onebot

**改动文件**：

* [commandCreateRole.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandCreateRole.ts)：导出 `buildCardName` 供外部复用

* [commandDice.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandDice.ts)：`rollResult` 在 `applyOutcomeUpdates` 后重新查询 GM 角色并更新其群名片（用 GM 的 userid，而非掷骰者的）

## \[1.3.0] - 2026-08-24

### 新增 - 群名片自动联动角色资源

**功能**：角色创建、设置属性、切换角色时自动更新群名片，名片格式随角色状态演进。

**名片格式规则**：

* 新建角色（属性未设）：`角色名`

* 已设属性角色：`角色名 希望x/x 生命x/x 压力x/x`

* GM 角色：`原始昵称 恐惧x/12`

**触发时机**：

* `pcnew` 创建角色后 → 名片设为角色名

* `gm` 创建主持人后 → 名片设为 `原始名 恐惧0/12`

* `st` 设置属性后 → 名片更新为 `角色名 希望x/x 生命x/x 压力x/x`

* `pcswitch` 切换角色后 → 名片更新为目标角色的资源

* `pcremove` 谢幕角色时 → 名片恢复为用户原始昵称（原有行为，未改动）

**改动文件**：

* [commandCreateRole.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandCreateRole.ts)：

  * 新增 `buildCardName` / `updateGroupCard` 辅助函数，统一名片格式逻辑

  * `pcnew` 创建后设名片为角色名

  * `gm` 创建后设名片为 `原始名 恐惧0/12`

  * `st` 用辅助函数替换重复的内联名片区码（含清理重复的 `cardName` 变量声明）

  * `switchRoles` 切换后更新名片为目标角色资源

## \[1.2.0] - 2026-08-24

### 新增 - 咕咕开关系统

**功能**：通过 `gugu` 命令控制机器人在每个群是否响应其他指令。

**新增命令**：

* `gugu on` — 开启响应（创建/更新群状态为启用）

* `gugu off` — 关闭响应（更新群状态为禁用，此后其他指令静默不响应）

* `gugu leave` — 机器人退出当前群（调用 onebot `setGroupLeave`）

**新增数据库表** **`gugustate`**：

* `groupid`（群号，唯一）

* `enabled`（是否启用）

**设计说明**：

* `gugu` 三命令本身**始终可用**，不受开关状态限制

* **未注册群默认响应**（避免新群无法 `gugu on` 的逻辑悖论）

* 关闭状态下，其他所有指令（`r`/`cook`/`.dd`/`.ddr`/`.r`/`.st`/`pcnew`/`gm`/`pcswitch`/`pcpc`/`pclist`/`pcremove`/`pcshow`/`showplayer`）静默不响应

**改动文件**：

* 新增 [commandGugu.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandGugu.ts)（命令 + `isGroupEnabled`/`ensureEnabled` 守卫函数）

* [database.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/utiles/database.ts) 新增 `GuguState` 接口与 `createGuguStateTable`

* [index.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/index.ts) 注册 gugu 命令与建表

* [commandDice.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandDice.ts) 给 `r`/`cook`/`.ddr`/`.dd`/`.r` 加守卫（5 处）

* [commandCreateRole.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandCreateRole.ts) 给 8 个 pc\*/gm/st 命令加守卫

* [commandBoard.ts](file:///c:/workbench/koilish/koishi-plugin-dice-dagger-heart/external/dice-dagger-heart/src/commands/commandBoard.ts) 给 `showplayer` 加守卫

## \[1.1.0] - 2026-08-24

### 修复 - 二元骰调整值表达式首项可省略 `+`

**问题**：`diceMatch` 的正则 `/^([+-]).../` 要求符号必填，而 `parseAdjustments` 的 `termRegex` `/([+-]?).../` 符号是可选的。两者不一致导致：当调整值表达式首项不带 `+` 时（如 `.dd1d6+2`、`.dd2+1d6`），`termRegex` 能匹配出 `1d6` / `2`，但 `diceMatch` 因要求符号返回 `null`，这些数字/骰子项被误送进名称解析路径，最终报"无法解析项"。

**修复**：将 `diceMatch` 的符号从必填改为可选（`/^([+-]?).../`），缺省视为 `+`，与 `termRegex` 保持一致。

**影响范围**：

* `.ddr敏捷` / `.dd敏捷+1d6+2` 等属性名开头的情况：原本已能工作，行为不变

* `.dd1d6+2` / `.dd2+1d6` 等骰子/数字开头不带 `+` 的情况：之前报错，现在正确解析为首项 `+1d6` / `+2`

* `.dd+敏捷` / `.dd+1d6+2` 等带 `+` 的情况：行为不变

## \[1.0.9] - 2026-08-24

### 修复 - `.ddr` 反应掷骰被重复执行

**问题**：`.ddr` 指令被前置中间件匹配处理后，原代码仍 `return next()` 把事件继续向下传递。下方的 `.dd` 中间件正则 `/^([。\.]dd)/i` 会把 `.ddr` 当成 `.dd` 再匹配一次（`dd` 是 `ddr` 的前缀），导致：

1. `rollResult` 被调用两次，群里连发两条结果
2. 第二次按 `.dd` 长度截取 rest，残留 `r...` 进入 `parseAdjustments`，行为异常
3. 第二次不是 `isPrepend`，会错误修改玩家/GM 的资源值

**修复**：前置中间件匹配到 `.ddr` 后直接 `return`（吞掉事件），不再调用 `next()`。未匹配时仍正常 `next()` 放行。

## \[1.0.8] - 2026-08-24

### 重构 - 二元骰掷骰机制

**目的**：消除 `commandDice.ts` 中 `rollResult` 的 12 个近乎重复的消息发送分支与 3 组重复辅助代码，提升可维护性。

**变更内容**：

* 引入 `OUTCOMES` 配置表，集中描述 hope / despair / critical 三种结果的差异（标题文案、命运寄语来源、是否显示合计、资源更新规则、变化行显示规则）

* 抽取 `pickQuote(config, key)` 替代 `hopeful / desperate / wonderful` 三个仅 config key 不同的函数

* 抽取 `applyOutcomeUpdates(ctx, spec, user, groupId)` 与 `buildUpdatePatch(row, updates)` 替代 3 处分散的 `ctx.database.set(...)` 资源更新块

* 抽取 `formatChangeLines(spec, character, gmCharacter)` 替代 `hopeChange / fearChange / stressChange` 三个结构相同的闭包

* 抽取 `parseAdjustments(rest, character, session, ctx)`，将 `rollResult` 中约 80 行的调整值解析逻辑独立成函数

* `rollResult` 由「3 结果 × 2 模式 × 2 调整值情况 = 12 个消息分支」塌缩为单条消息构建路径，根据 `OUTCOMES` 配置拼接 `adjustStr / changeLine / prependLine / totalLine`

* 清理无用代码：删除未被引用的 `hopefuljson / desperatejson / wonderfuljson` 数组、`cookResult` 函数、文件底部重复的 `parseFlavor` 实现，以及 `cook` 命令中残留的注释代码块

### 修复

* 修复 `parseAdjustments` 在遇到无法解析的经验标记时既不 `i++` 也不 `return`，导致 `while` 死循环的潜在 bug（现在统一 `return null` 退出）

### 行为一致性

* `.dd` / `.ddr` / `r` / `cook` 四个命令的对外行为与 1.0.7 完全一致

* 消息文案与资源更新顺序保持原样（先更新数据库再发送消息，消息中的变化值仍使用更新前的快照）

* 关键成功时不再显示「合计 X」行（与原行为一致）

* 反应掷骰（`isPrepend`）不修改数据库资源（与原行为一致）

