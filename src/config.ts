import { Schema } from "koishi";

export interface Config {
  dalayTime: number;
}
export const ConfigSchema: Schema<Config> = Schema.object({
  dalayTime: Schema.number()
    .default(1000)
    .description("骰子掷出延迟时间（毫秒）"),
});
