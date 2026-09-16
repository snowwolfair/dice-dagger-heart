import { Context, Session } from "koishi";
import { RuleSet } from "./utiles/rules";

declare module "koishi" {
  interface Context {
    diceCore: DiceCoreService;
  }
}

// ==================== DiceCore 服务接口 ====================

/** 命令 action 的类型（与 koishi Command.action 签名对齐） */
type CommandAction = (argv: any, ...args: any[]) => any;

export interface DiceCoreService {
  /** 注册规则集（setrule 可切换） */
  registerRule(rule: RuleSet): void;
  /** 注册二元骰系统（自动注册 .dd/.ddr 中间件，带规则路由+gugu守卫） */
  registerDiceSystem(ctx: Context, config: DiceSystemConfig): void;
  /** 注册规则专属指令（中间件）：自动包裹 gugu + 规则守卫，非当前规则时静默不响应。
   *  扩展插件用此函数注册，无需手动调用 ensureRule/ensureEnabled */
  ruleCommand(
    ctx: Context,
    ruleKey: string,
    decl: string,
    action: CommandAction,
  ): void;
  /** 规则守卫：当前群规则 === ruleKey 时返回 true */
  ensureRule(session: Session, ruleKey: string): Promise<boolean>;
  /** gugu 守卫：群开关启用时返回 true */
  ensureEnabled(session: Session): Promise<boolean>;
}

// ==================== 二元骰系统配置 ====================

export interface DiceSystemConfig {
  /** 所属规则 key，必须与 registerRule 的 key 一致 */
  ruleKey: string;

  // —— 骰子配置 ——
  /** 骰子面数（DH=12） */
  diceSides: number;
  /** 正面骰显示名（如 "希望骰"） */
  positiveDieName: string;
  /** 负面骰显示名（如 "恐惧骰"） */
  negativeDieName: string;
  /** 自定义掷骰钩子（可选）：在默认 rollTwoDice 之前调用，
   *  可根据角色状态（如残月）返回自定义骰面的骰子。
   *  返回 [positive, negative] 则使用该结果；返回 undefined 则走默认逻辑。 */
  customRollDice?: (ctx: Context, session: Session, config: DiceSystemConfig) =>
    Promise<[number, number] | undefined> | [number, number] | undefined;

  // —— 三种结果配置 ——
  outcomes: {
    /** 正面结果（正面骰 > 负面骰） */
    positive: OutcomeConfig;
    /** 负面结果（正面骰 < 负面骰） */
    negative: OutcomeConfig;
    /** 关键成功（正面骰 === 负面骰） */
    critical: OutcomeConfig;
  };

  // —— 调整值解析 ——
  /** 中文属性名 → 数据库字段映射（如 { "敏捷": "agility" }） */
  propertyDict: Record<string, string>;
  /** 优势/劣势映射（如 { "优势": "+1d6" }） */
  proConDict?: Record<string, string>;

  // —— 角色卡 ——
  /** 数据库表名（如 "playercharacter"） */
  characterTable: string;
  /** GM 角色名（DH="GM"） */
  gmRoleName: string;

  // —— 群名片 ——
  /** 构建群名片文本（不同规则名片格式不同） */
  buildCardName: (character: any) => string;
}

// ==================== 结果配置 ====================

export interface OutcomeConfig {
  /** 结果标签（如 "希望结果"） */
  label: string;
  /** 命运寄语池（掷骰时随机抽取一句） */
  quotes: string[];
  /** 是否在消息中显示合计值 */
  showTotal: boolean;
  /** 标准资源变化列表（固定字段、固定方向、固定 cap） */
  resources: ResourceChange[];
  /** 自定义资源更新钩子（可选）：在 resources 标准更新之后执行 */
  customUpdate?: (params: UpdateParams) => Promise<void>;
  /** 自自定义变化行显示钩子（可选）：在 resources 标准显示之后追加 */
  customDisplay?: (params: DisplayParams) => Promise<string>;
}

// ==================== 资源变化（声明式） ====================

export interface ResourceChange {
  // —— 更新逻辑 ——
  /** 更新谁的角色卡 */
  target: "player" | "gm";
  /** 数据库字段路径（如 "hope"） */
  field: string;
  /** 变化方向：+1 或 -1 */
  direction: 1 | -1;
  /** 上限（direction=1 时生效）或下限（direction=-1 时生效） */
  cap: number;

  // —— 显示逻辑 ——
  /** 消息中的标签（如 "[希望值变化]"） */
  displayLabel: string;
  /** 无角色时的默认显示值 */
  defaultValue: number;
  /** 触顶/触底时的显示文本（如 "6(已满)"） */
  capLabel: string;
}

// ==================== 钩子参数 ====================

/** customUpdate / customDisplay 的共用参数 */
export interface UpdateParams {
  ctx: Context;
  session: Session;
  /** 本次掷骰结果 */
  rollResult: {
    positive: number;
    negative: number;
    total: number;
  };
  /** 当前玩家角色（可能为空数组） */
  character: any[];
  /** GM 角色（可能为空数组） */
  gmCharacter: any[];
}

/** customDisplay 的参数 */
export interface DisplayParams extends UpdateParams {}
