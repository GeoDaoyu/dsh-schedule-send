# 定时发送 · dsh-schedule-send

在 DSH 的输入框里选一个时间，把这条消息留到点再执行。

它把当前草稿变成一条官方 [@deepseek-ai/dsh-schedule](https://www.npmjs.com/package/@deepseek-ai/dsh-schedule) 的一次性任务，到点才投递到这条会话。登记的时候不跑模型，所以既不会在峰时先把活干完，也不会把半成品的分析带进正式那一轮。

## 为什么不用「12 点执行某某任务」这句话

| | 跟模型说「12 点执行」 | 这个插件 |
| --- | --- | --- |
| 登记那一轮 | 先跑一轮模型，通常还会顺手把资料查了 | 纯前端调用 Schedule 服务的 `create`，零模型调用 |
| 到点那一轮 | 带着从建任务到现在的全部上下文 | 只有投递的那条消息，不受登记过程影响 |
| 稳定性 | 取决于模型是否遵守「现在只登记」的约束 | 时间、目标、原文都由服务端按参数保存 |

## 安装

在 Web 或 Desktop 的 **插件 → 添加插件** 里搜索 `dsh-schedule-send` 安装；或用 CLI：

```bash
dsh plugin --profile web add dsh-schedule-send
```

装好后刷新页面。浏览器那一半会自动加载，Host 那一半只等 `schedule` 服务就绪，自己不留状态。

## 用法

1. 在输入框里写好要做的事。定时任务会把**这段原文**在到点时发给模型，所以按「第一次收到这条请求」的口吻写全：目标、范围、产出、约束。
2. 点「定时」：
   - 新会话首页：在输入框上方那行，「标准模式」右边；
   - 已有会话：在输入框左下角，「完全权限」后面。
3. 选时间：常用时刻（08:00 / 12:00 / 18:00 / 21:00 的最近一次），或用时间输入框选其他时间。
4. 输入框上方出现确认条，点「定时执行」。草稿清空，提示「已安排 今天 12:00 执行」。
5. 到点后消息投递到这条会话，模型才开始干活。任务可以在侧边栏的 **自动化任务** 里查看、暂停、删除。

## 行为与限制

- 只创建一次性任务（`at`），不提供重复规则；需要每天跑的任务请直接用「自动化任务」页或 `schedule_create`。
- 投递目标固定为**当前会话**，不会新建会话。
- 只投递文本：草稿里的附件不会随任务发送（确认条会提示）。
- 任务标题取草稿第一行前 60 个字符，方便在任务列表里认。
- 时间按浏览器所在时区（IANA 名称，例如 `Asia/Shanghai`）解释；换机器或换时区会按当时的浏览器时区计算。
- 选好的时间只存在当前页面的内存里，刷新页面就没了；已经创建的任务是持久的。
- Host 必须开着才会投递；停机期间到期的那次，会在下次启动时补投一次。
- 需要 DSH 0.2.2-rc.1 及以上，且配置里要有 `@deepseek-ai/dsh-schedule`（`dsh-base` / `dsh-web-app` 自带）；没有这个服务时插件不会显示。

## 卸载

在 **插件** 里移除，或：

```bash
dsh plugin --profile web remove dsh-schedule-send
```

卸载不会删除已经创建的任务，它们在「自动化任务」里照常存在。

## 开发

纯 JavaScript，没有构建步骤：

- `index.js`：Host 半边，`inject = ['schedule']`，没有逻辑。
- `client.js`：全部界面。通过 `ctx.slots` 注册到 `conversation.hero.options`、`conversation.input.left` 和 `conversation.input.dock`，用 `ctx.remote.schedule.create()` 建任务。
- `locale/*.json`：插件列表里的标题与说明。
- `cordis.patch.yml`：bundle 的 patch 层，插入 plugin 行。

本地目录安装是软链接，改完 `client.js` 刷新页面即可看到效果（改 `package.json` 或新增文件需要在插件页重新安装）。

## License

MIT
