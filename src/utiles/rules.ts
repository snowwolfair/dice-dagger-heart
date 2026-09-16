// ==================== 规则集注册中心 ====================

/** 规则集定义：每个规则集对应一套独立的骰子指令与角色卡系统 */
export interface RuleSet {
  /** 规范 key，用于数据库存储与代码引用，如 "DH" */
  key: string;
  /** 中文显示名，如 "匕首之心" */
  name: string;
  /** 触发别名，setrule 接受这些输入均会解析到此规则 */
  aliases: string[];
  /** 规则简介 */
  description: string;
}

/** 已注册的规则集列表。基底启动时注册 DH，扩展插件通过 registerRule 追加 */
const RULES: RuleSet[] = [
  {
    key: "DH",
    name: "匕首之心",
    aliases: ["DH", "匕首之心", "daggerheart", "dagger heart", "匕首"],
    description: "Daggerheart 二元骰（希望/恐惧）系统",
  },
];

/** 注册新规则集（供扩展插件调用）。key 重复时静默跳过（幂等），避免插件热重载时抛错 */
export function registerRule(rule: RuleSet): void {
  if (RULES.some((r) => r.key === rule.key)) {
    return;
  }
  RULES.push(rule);
}

/** 默认规则 key，未注册的群使用此规则 */
export const DEFAULT_RULE_KEY = "DH";

/** 列出所有已注册规则集 */
export function listRules(): RuleSet[] {
  return RULES;
}

/** 默认规则集 */
export function getDefaultRule(): RuleSet {
  return RULES.find((r) => r.key === DEFAULT_RULE_KEY)!;
}

/** 根据用户输入解析规则集（匹配 key / name / aliases，大小写不敏感）。未匹配返回 null */
export function resolveRule(input: string): RuleSet | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const rule of RULES) {
    if (rule.key.toLowerCase() === lower) return rule;
    if (rule.name === trimmed) return rule;
    if (rule.aliases.some((a) => a.toLowerCase() === lower)) return rule;
  }
  return null;
}

/** 生成可用规则列表的提示文本，如 "DH(匕首之心)" */
export function formatRuleList(): string {
  return RULES.map((r) => `${r.key}(${r.name})`).join("、");
}
