import { Schema } from "koishi";

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
