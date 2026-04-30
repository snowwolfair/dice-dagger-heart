# @mashroomwolf/koishi-plugin-dice-dagger-heart

[![npm](https://img.shields.io/npm/v/@mashroomwolf/koishi-plugin-dice-dagger-heart?style=flat-square)](https://www.npmjs.com/package/@mashroomwolf/koishi-plugin-dice-dagger-heart)

一个匕首之心骰子机器人插件

# 食用方法

- `dd` 指令可以掷出二元骰
- `dd +2+1d4` 可以在二元骰后进行加值
- `r 1d6` 指令可以掷出普通骰子
- `r 1d6 +2` 可以在普通骰子后进行加值
- `pcnew <人物名>` 指令可以创建人物卡
- `pcshow <人物名>` 指令可以查询人物卡属性
- `st <属性>` 指令可以录入人物卡属性

# 注意事项

- 目前仅测试了 QQ onebot 机器人可用

# 开发计划

- [x] 实现基本的二元骰功能
- [x] 实现基本的普通骰子功能
- [x] 实现人物卡创建功能
- [x] 实现人物卡查询功能
- [x] 实现人物卡属性录入功能
- [ ] 实现人物卡与猫猫头车卡器的数据匹配

# 开发日志

> ## V1.0.0 基本功能上线
>
> 人物卡属性自动更新
> 更改群昵称
>
> ## V0.0.7 人物卡更新
>
> 新增人物卡创建功能
> 新增人物卡查询功能
> 录入人物卡属性
>
> ## V0.0.6 命令美化
>
> 新增自定义结果语句

---

<details>
<summary>
  更久之前的更新
</summary>

> ## V0.0.4 命令更新
>
> 修改命令触发从命令改为中间件
>
> ## V0.0.1 初始版本
>
> 初始版本，仅包含基本的骰子功能

</details>
