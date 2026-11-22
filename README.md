# Schedule send · dsh-schedule-send

Pick a time in the DSH composer and leave the message until then.

The plugin turns the current draft into a one-shot
[@deepseek-ai/dsh-schedule](https://www.npmjs.com/package/@deepseek-ai/dsh-schedule)
task delivered to this conversation at the chosen time. Nothing runs while you
register it, so no tokens are spent early and the real run does not inherit a
half-finished analysis.

## Why not just ask the model to run at 12:00

| | "Run this at 12:00" in the composer | This plugin |
| --- | --- | --- |
| Registration | One model turn, which usually starts the work right away | A browser call to the Schedule service's `create`; no model turn |
| At the chosen time | Delivered with the whole registration conversation as context | Delivered with only the message you scheduled |
| Reliability | Depends on the model honouring "register only" | Timing, target, and text are stored by the service |

## Install

Search `dsh-schedule-send` in **Plugins → Add plugin** in the Web or Desktop
app, or use the CLI:

```bash
dsh plugin --profile web add dsh-schedule-send
```

Refresh the page afterwards. The browser half loads automatically; the Host
half only waits for the `schedule` service and keeps no state of its own.

## Use

1. Write the task in the composer. The scheduled task sends **that text** to the
   model at the chosen time, so write it the way you would write a first
   message: goal, scope, output, constraints.
2. Click **Schedule** — on the new-session home it sits in the row above the
   composer, after the preset control; inside a conversation it sits in the
   composer tool row after the access-mode control.
3. Pick a time: a common hour (the next 08:00 / 12:00 / 18:00 / 21:00) or any
   other time in the time field.
4. A confirmation bar appears above the composer. Click **Schedule**. The draft
   clears and the bar reports the scheduled time.
5. At that time the message is delivered to this conversation and the model
   starts working. Review, pause, or delete the task under **Automation tasks**
   in the sidebar.

## Behaviour and limits

- One-shot `at` tasks only; there are no recurrence rules. Use the Automation
  tasks page or `schedule_create` for recurring work.
- The delivery target is always the **current conversation**; no new
  conversation is created.
- Text only: attachments in the draft are not scheduled, and the bar says so.
- The task title is the first line of the draft, truncated to 60 characters.
- Times are interpreted in the browser's IANA time zone (for example
  `Asia/Shanghai`).
- The armed time lives in the page's memory only; a refresh forgets it, while
  created tasks are durable.
- The Host must be running to deliver. An occurrence that comes due while the
  Host is stopped is delivered once on the next start.
- Requires DSH 0.2.2-rc.1 or later with `@deepseek-ai/dsh-schedule` present
  (shipped by `dsh-base` and `dsh-web-app`). Without that service the composer
  control does not appear.

## Uninstall

Remove it in **Plugins**, or:

```bash
dsh plugin --profile web remove dsh-schedule-send
```

Removing the plugin leaves created tasks in place; they still fire under
Automation tasks.

## Development

Plain JavaScript, no build step:

- `index.js` — Host half: `inject = ['schedule']` and no logic.
- `client.js` — the whole UI. It registers through `ctx.slots` into
  `conversation.hero.options`, `conversation.input.left`, and
  `conversation.input.dock`, and creates tasks with
  `ctx.remote.schedule.create()`.
- `locale/*.json` — the title and description shown in the plugin list.
- `cordis.patch.yml` — the bundle patch that inserts the plugin row.

A local-directory install is a symlink, so editing `client.js` and refreshing
the page is enough; changing `package.json` or adding files needs a reinstall
from the Plugins page.

## License

MIT
