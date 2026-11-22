/**
 * dsh-schedule-send — browser half.
 *
 * A clock control beside the mode selector picks a wall-clock time; a thin
 * confirmation bar above the composer then turns the current draft into a
 * one-shot task on the official @deepseek-ai/dsh-schedule service
 * (`remote.schedule.create`), so nothing runs until the chosen time and no
 * model turn is spent on registration.
 *
 * Placement follows the public slot contract only:
 *   - `conversation.hero.options`   new-session row, after the preset control
 *   - `conversation.input.left`     composer tool row, non-blank sessions
 *   - `conversation.input.dock`     the confirmation bar above the card
 * Fixed overlays portal to the document body because the composer is their
 * containing block.
 */
window.__ModuleLoader__.load({
  id: 'dsh-schedule-send',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } = React

    const NAME = 'dsh-schedule-send'
    const NS = 'scheduleSend'
    const STYLE_TAG_ID = `${NAME}/styles.css`

    /* ---------------------------------------------------------------- copy */

    const zh = {
      trigger: '定时',
      'trigger.tooltip': '选一个时间，到点再执行这条内容',
      'picker.title': '定时执行',
      'picker.subtitle': '到点后在这条会话里执行输入框的内容',
      'picker.today': '今天',
      'picker.tomorrow': '明天',
      'picker.other': '其他时间',
      'picker.hint': '选好时间后，点输入框上方的「定时执行」',
      'bar.title': '定时执行',
      'bar.remaining': '还有 {time}',
      'bar.imminent': '不到 1 分钟',
      'bar.cancel': '取消',
      'bar.confirm': '定时执行',
      'bar.needDraft': '先输入要执行的内容',
      'bar.attachments': '附件不会随定时任务发送',
      'bar.done': '已安排 {time} 执行',
      'bar.doneHint': '可在「自动化任务」里查看或取消',
      'bar.failed': '创建失败：{message}',
      'bar.dismiss': '关闭',
      'unit.hour': '小时',
      'unit.minute': '分钟',
    }

    const en = {
      trigger: 'Schedule',
      'trigger.tooltip': 'Pick a time and run this message later',
      'picker.title': 'Run later',
      'picker.subtitle': 'Runs the composer text in this conversation at the chosen time',
      'picker.today': 'Today',
      'picker.tomorrow': 'Tomorrow',
      'picker.other': 'Other time',
      'picker.hint': 'Pick a time, then confirm above the composer',
      'bar.title': 'Run later',
      'bar.remaining': 'in {time}',
      'bar.imminent': 'in under a minute',
      'bar.cancel': 'Cancel',
      'bar.confirm': 'Schedule',
      'bar.needDraft': 'Type the message first',
      'bar.attachments': 'Attachments are not included',
      'bar.done': 'Scheduled for {time}',
      'bar.doneHint': 'Manage or cancel it in Automation tasks',
      'bar.failed': 'Could not schedule: {message}',
      'bar.dismiss': 'Dismiss',
      'unit.hour': 'hr',
      'unit.minute': 'min',
    }

    /* -------------------------------------------------------------- styles */

    const STYLES = `
.dss-root { display: inline-flex; align-items: center; min-width: 0; }

.dss-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  min-width: 0;
  max-width: 180px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}
@media (hover: hover) { .dss-trigger:hover { background: var(--dsw-alias-interactive-bg-hover); } }
.dss-trigger:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dss-trigger[data-armed] {
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-state-business-primary);
}
@media (hover: hover) { .dss-trigger[data-armed]:hover { background: var(--dsw-alias-state-business-tertiary); } }
.dss-trigger-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dss-glyph { flex: none; }
.dss-chevron { flex: none; color: var(--dsw-alias-label-tertiary); }
.dss-trigger[data-armed] .dss-chevron { color: var(--dsw-alias-state-business-primary); }

.dss-panel {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 264px;
  padding: 12px;
  border-radius: 16px;
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
}
.dss-panel-title { font-size: 13px; font-weight: 600; line-height: 20px; }
.dss-panel-sub { margin-top: 2px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dss-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.dss-preset {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 7px 9px;
  border: 0;
  border-radius: 10px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
@media (hover: hover) { .dss-preset:hover { background: var(--dsw-alias-interactive-bg-hover-accent); } }
.dss-preset:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dss-preset-time { font-size: 13px; font-weight: 500; line-height: 20px; font-variant-numeric: tabular-nums; }
.dss-preset-day { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dss-sep { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dss-sep::after { flex: 1; height: 0.5px; background: var(--dsw-alias-border-l2); content: ''; }
.dss-time {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
}
.dss-time:focus-visible { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.dss-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }

.dss-dock {
  box-sizing: border-box;
  width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  margin: 0 auto;
}
.dss-bar {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));
  min-height: 36px;
  margin: 0 auto;
  padding: 4px 5px 4px 12px;
  border: 0;
  border-radius: var(--dsw-radius-md);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-panel);
}
.dss-bar::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  content: '';
  pointer-events: none;
}
.dss-bar-icon { display: inline-flex; flex: none; color: var(--dsw-alias-label-tertiary); }
.dss-bar-icon[data-state='done'] { color: var(--dsw-alias-state-success-primary); }
.dss-bar-label { flex: none; font-size: 13px; font-weight: 500; line-height: 24px; color: var(--dsw-alias-label-primary); }
.dss-bar-when { flex: none; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary-dimmed); }
.dss-bar-note { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.dss-bar-flag { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; height: 20px; border-radius: 999px; background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-state-warn-label); font-size: 12px; line-height: 18px; white-space: nowrap; }
.dss-bar-error { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; line-height: 20px; color: var(--dsw-alias-state-error-primary); text-overflow: ellipsis; white-space: nowrap; }
.dss-bar-actions { display: flex; flex: none; align-items: center; gap: 6px; }

.dss-ghost {
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}
@media (hover: hover) { .dss-ghost:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); } }
.dss-primary {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-3);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}
.dss-primary:disabled { opacity: 0.4; cursor: default; }
.dss-ghost:focus-visible,
.dss-primary:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
`

    /* -------------------------------------------------------------- helpers */

    const pad2 = value => String(value).padStart(2, '0')
    const clockText = date => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
    const isoDate = date => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    const isoTime = date => `${clockText(date)}:${pad2(date.getSeconds())}`

    /** Resolve one wall-clock time to its next future occurrence. */
    function nextOccurrence(hour, minute, now) {
      const target = new Date(now.getTime())
      target.setHours(hour, minute, 0, 0)
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
      return target
    }

    /** Resolve an `<input type="time">` value to its next future occurrence. */
    function fromTimeInput(value, now) {
      const parts = /^(\d{1,2}):(\d{2})/.exec(value || '')
      if (parts === null) return undefined
      return nextOccurrence(Number(parts[1]), Number(parts[2]), now)
    }

    /** Today / tomorrow / month-day for one target, in the active locale. */
    function dayWord(date, now, t) {
      const startOfDay = value => {
        const copy = new Date(value.getTime())
        copy.setHours(0, 0, 0, 0)
        return copy.getTime()
      }
      const days = Math.round((startOfDay(date) - startOfDay(now)) / 86400000)
      if (days === 0) return t('picker.today')
      if (days === 1) return t('picker.tomorrow')
      return `${date.getMonth() + 1}/${date.getDate()}`
    }

    /** "today 12:00" — the label shared by the trigger, the bar, and the picker. */
    function whenText(at, now, t) {
      return `${dayWord(at, now, t)} ${clockText(at)}`
    }

    /** Remaining wait in the active locale's unit words. */
    function remainingText(at, now, t) {
      const minutes = Math.round((at.getTime() - now.getTime()) / 60000)
      if (minutes < 1) return t('bar.imminent')
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      if (hours === 0) return `${rest} ${t('unit.minute')}`
      if (rest === 0) return `${hours} ${t('unit.hour')}`
      return `${hours} ${t('unit.hour')} ${rest} ${t('unit.minute')}`
    }

    /** The IANA zone the wall-clock entry is interpreted in. */
    function zoneName() {
      try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
        return typeof zone === 'string' && zone !== '' ? zone : 'UTC'
      } catch (_error) {
        return 'UTC'
      }
    }

    /** A 120-character-safe task title taken from the draft's first line. */
    function taskTitle(text) {
      const firstLine = text.split('\n').map(line => line.trim()).find(line => line !== '') || ''
      const compact = firstLine.replace(/\s+/g, ' ')
      if (compact === '') return 'Scheduled message'
      return compact.length > 60 ? `${compact.slice(0, 60)}…` : compact
    }

    /** Human text for one Remote failure or thrown error. */
    function failureText(error) {
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string' && error.message !== '') return error.message
        if (typeof error.code === 'string' && error.code !== '') return error.code
      }
      return String(error)
    }

    /* --------------------------------------------------- per-session memory */

    const armedBySession = new Map()
    const armedListeners = new Set()

    function notifyArmed() {
      for (const listener of [...armedListeners]) {
        try {
          listener()
        } catch (_error) {
          /* One subscriber's failure must not skip the others. */
        }
      }
    }

    function readArmed(sessionId) {
      return sessionId === undefined ? undefined : armedBySession.get(sessionId)
    }

    function writeArmed(sessionId, at) {
      if (sessionId === undefined) return
      const previous = armedBySession.get(sessionId)
      if (at === undefined) {
        if (previous === undefined) return
        armedBySession.delete(sessionId)
      } else {
        if (previous === at) return
        armedBySession.set(sessionId, at)
      }
      notifyArmed()
    }

    /** Subscribe one component to the session's armed time. */
    function useArmed(sessionId) {
      const subscribe = useCallback(listener => {
        armedListeners.add(listener)
        return () => { armedListeners.delete(listener) }
      }, [])
      const snapshot = useCallback(() => readArmed(sessionId), [sessionId])
      return useSyncExternalStore(subscribe, snapshot, snapshot)
    }

    /* ---------------------------------------------------------------- icons */

    function ClockIcon({ size = 14 }) {
      return h('svg', {
        className: 'dss-glyph', width: size, height: size, viewBox: '0 0 16 16',
        fill: 'none', 'aria-hidden': true,
      },
      h('circle', { cx: 8, cy: 8, r: 5.6, stroke: 'currentColor', strokeWidth: 1.4 }),
      h('path', {
        d: 'M8 4.9v3.3l2.1 1.4', stroke: 'currentColor', strokeWidth: 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    function ChevronIcon() {
      return h('svg', {
        className: 'dss-chevron', width: 12, height: 12, viewBox: '0 0 16 16',
        fill: 'none', 'aria-hidden': true,
      },
      h('path', {
        d: 'M4.5 6.5 8 10l3.5-3.5', stroke: 'currentColor', strokeWidth: 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    function CheckIcon({ size = 14 }) {
      return h('svg', {
        className: 'dss-glyph', width: size, height: size, viewBox: '0 0 16 16',
        fill: 'none', 'aria-hidden': true,
      },
      h('path', {
        d: 'm3.6 8.4 2.9 2.8 5.9-6', stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    /* ---------------------------------------------------------- time picker */

    const PRESETS = [[8, 0], [12, 0], [18, 0], [21, 0]]

    /**
     * One anchored panel of quick times plus a custom wall-clock entry.
     * @param props - the trigger element, copy, current arming, and callbacks.
     */
    function TimePanel({ anchorRef, t, current, onPick, onClose }) {
      const panelRef = useRef(null)
      const [position, setPosition] = useState(undefined)
      const [custom, setCustom] = useState(() => {
        const now = new Date()
        return current === undefined ? clockText(nextOccurrence(12, 0, now)) : clockText(new Date(current))
      })

      const place = useCallback(() => {
        const anchor = anchorRef.current
        const panel = panelRef.current
        if (anchor === null) return
        const rect = anchor.getBoundingClientRect()
        const width = panel === null ? 264 : panel.offsetWidth
        const height = panel === null ? 240 : panel.offsetHeight
        const margin = 12
        const below = rect.bottom + 6
        const above = rect.top - 6 - height
        const fitsBelow = window.innerHeight - rect.bottom >= height + margin
        const top = fitsBelow || above < margin ? Math.min(below, window.innerHeight - height - margin) : above
        const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin))
        setPosition({ top: Math.max(margin, top), left })
      }, [anchorRef])

      useLayoutEffect(() => { place() }, [place])

      useEffect(() => {
        const onViewportChange = () => { place() }
        window.addEventListener('scroll', onViewportChange, true)
        window.addEventListener('resize', onViewportChange)
        return () => {
          window.removeEventListener('scroll', onViewportChange, true)
          window.removeEventListener('resize', onViewportChange)
        }
      }, [place])

      useEffect(() => {
        const onPointerDown = event => {
          const target = event.target
          if (panelRef.current !== null && panelRef.current.contains(target)) return
          if (anchorRef.current !== null && anchorRef.current.contains(target)) return
          onClose()
        }
        const onKeyDown = event => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
          // Escape returns focus to the control that opened the panel.
          if (anchorRef.current !== null) anchorRef.current.focus()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [anchorRef, onClose])

      const now = new Date()

      return createPortal(
        h('div', {
          ref: panelRef,
          className: 'dss-panel',
          role: 'dialog',
          'aria-label': t('picker.title'),
          style: position === undefined
            ? { top: -10000, left: -10000 }
            : { top: position.top, left: position.left },
        },
        h('div', null,
          h('div', { className: 'dss-panel-title' }, t('picker.title')),
          h('div', { className: 'dss-panel-sub' }, t('picker.subtitle')),
        ),
        h('div', { className: 'dss-presets' }, PRESETS.map(([hour, minute]) => {
          const at = nextOccurrence(hour, minute, now)
          return h('button', {
            key: `${hour}:${minute}`,
            type: 'button',
            className: 'dss-preset',
            onClick: () => { onPick(at.getTime()); onClose() },
          },
          h('span', { className: 'dss-preset-time' }, clockText(at)),
          h('span', { className: 'dss-preset-day' }, dayWord(at, now, t)))
        })),
        h('div', { className: 'dss-sep' }, t('picker.other')),
        h('input', {
          className: 'dss-time',
          type: 'time',
          step: 60,
          value: custom,
          'aria-label': t('picker.other'),
          onChange: event => {
            const value = event.target.value
            setCustom(value)
            const at = fromTimeInput(value, new Date())
            if (at !== undefined) onPick(at.getTime())
          },
        }),
        h('div', { className: 'dss-hint' }, t('picker.hint'))),
        document.body,
      )
    }

    /* ------------------------------------------------------------- trigger */

    /**
     * The clock control: shows the armed time, and opens the time panel.
     * @param props - standard Session props plus the placement variant.
     */
    function ClockTrigger({ t, sessionId, variant }) {
      const armed = useArmed(sessionId)
      const [open, setOpen] = useState(false)
      const anchorRef = useRef(null)

      useEffect(() => { setOpen(false) }, [sessionId])

      const now = new Date()
      const label = armed === undefined ? t('trigger') : whenText(new Date(armed), now, t)

      return h('div', { className: 'dss-root' },
        h('button', {
          ref: anchorRef,
          type: 'button',
          className: 'dss-trigger',
          'data-variant': variant,
          'data-armed': armed === undefined ? undefined : '',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          title: t('trigger.tooltip'),
          onClick: () => { setOpen(value => !value) },
        },
        h(ClockIcon, { size: 14 }),
        h('span', { className: 'dss-trigger-label' }, label),
        h(ChevronIcon, null)),
        open
          ? h(TimePanel, {
            anchorRef,
            t,
            current: armed,
            onPick: at => { writeArmed(sessionId, at) },
            onClose: () => { setOpen(false) },
          })
          : null)
    }

    /** Composer-row clock: hidden on the blank home, which already shows the hero one. */
    function ComposerClock(props) {
      const blank = props.useSession(state => state.blank)
      if (blank) return null
      return h(ClockTrigger, { ...props, variant: 'inline' })
    }

    /* ------------------------------------------------------- confirmation bar */

    /**
     * The armed bar above the composer card: confirms, cancels, and reports.
     * @param props - standard Session props, copy, and the Client context.
     */
    function ConfirmBar({ t, ctx, sessionId, useInput, inputActions }) {
      const armed = useArmed(sessionId)
      const draft = useInput(state => state.draft)
      const attachments = useInput(state => state.attachmentIds.length)
      const phase = useInput(state => state.phase)
      const [busy, setBusy] = useState(false)
      const [failure, setFailure] = useState(undefined)
      const [done, setDone] = useState(undefined)
      const dismissTimer = useRef(undefined)

      useEffect(() => () => {
        if (dismissTimer.current !== undefined) clearTimeout(dismissTimer.current)
      }, [])

      useEffect(() => { setFailure(undefined) }, [armed])

      // Sending the draft now consumes the text the arming was meant for, so the
      // pending schedule is dropped instead of lingering over an empty composer.
      useEffect(() => {
        if (phase !== 'sending' && phase !== 'submitting') return
        writeArmed(sessionId, undefined)
      }, [phase, sessionId])

      const submit = useCallback(async () => {
        const text = draft.trim()
        if (text === '' || armed === undefined) return
        setBusy(true)
        setFailure(undefined)
        try {
          const at = new Date(armed)
          const result = await ctx.remote.schedule.create({
            title: taskTitle(text),
            prompt: text,
            timing: { kind: 'at', at: { date: isoDate(at), time: isoTime(at), time_zone: zoneName() } },
            target: { kind: 'session', sessionId },
          })
          if (result !== undefined && result.ok === false) {
            setFailure(failureText(result.error))
            return
          }
          const label = whenText(at, new Date(), t)
          inputActions.setDraft('')
          writeArmed(sessionId, undefined)
          setDone(label)
          if (dismissTimer.current !== undefined) clearTimeout(dismissTimer.current)
          dismissTimer.current = setTimeout(() => { setDone(undefined) }, 8000)
        } catch (error) {
          setFailure(failureText(error))
        } finally {
          setBusy(false)
        }
      }, [armed, ctx, draft, inputActions, sessionId, t])

      if (done !== undefined) {
        return h('div', { className: 'dss-dock' },
          h('div', { className: 'dss-bar', role: 'status' },
            h('span', { className: 'dss-bar-icon', 'data-state': 'done' }, h(CheckIcon, { size: 14 })),
            h('span', { className: 'dss-bar-label' }, t('bar.done', { time: done })),
            h('span', { className: 'dss-bar-note' }, t('bar.doneHint')),
            h('div', { className: 'dss-bar-actions' },
              h('button', {
                type: 'button', className: 'dss-ghost',
                onClick: () => {
                  if (dismissTimer.current !== undefined) clearTimeout(dismissTimer.current)
                  setDone(undefined)
                },
              }, t('bar.dismiss')))))
      }

      if (armed === undefined) return null

      const at = new Date(armed)
      const empty = draft.trim() === ''

      return h('div', { className: 'dss-dock' },
        h('div', { className: 'dss-bar', role: 'group', 'aria-label': t('bar.title') },
          h('span', { className: 'dss-bar-icon' }, h(ClockIcon, { size: 14 })),
          h('span', { className: 'dss-bar-label' }, t('bar.title')),
          h('span', { className: 'dss-bar-when' }, whenText(at, new Date(), t)),
          failure !== undefined
            ? h('span', { className: 'dss-bar-error', title: failure }, t('bar.failed', { message: failure }))
            : h('span', { className: 'dss-bar-note' },
              empty ? t('bar.needDraft') : t('bar.remaining', { time: remainingText(at, new Date(), t) })),
          attachments > 0
            ? h('span', { className: 'dss-bar-flag' }, t('bar.attachments'))
            : null,
          h('div', { className: 'dss-bar-actions' },
            h('button', {
              type: 'button',
              className: 'dss-ghost',
              disabled: busy,
              onClick: () => { writeArmed(sessionId, undefined) },
            }, t('bar.cancel')),
            h('button', {
              type: 'button',
              className: 'dss-primary',
              disabled: busy || empty,
              onClick: submit,
            }, t('bar.confirm')))))
    }

    /* --------------------------------------------------------------- plugin */

    function mountStyles() {
      if (typeof document === 'undefined') return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = NAME
      tag.dataset.pluginCss = STYLE_TAG_ID
      tag.textContent = STYLES
      document.head.appendChild(tag)
      return () => { tag.remove() }
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.schedule'],
      apply(ctx) {
        ctx.effect(() => mountStyles(), `${NAME}: styles`)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NAME}: dictionaries`)

        ctx.slots.inject('conversation.hero.options', () => ctx.slots.register({
          name: 'conversation.hero.options',
          id: 'schedule-send',
          order: 100,
          locale: NS,
        }, props => h(ClockTrigger, { ...props, variant: 'hero' })))

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'schedule-send',
          order: 100,
          locale: NS,
        }, ComposerClock))

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'schedule-send',
          order: 30,
          locale: NS,
        }, props => h(ConfirmBar, { ...props, ctx })))
      },
    }
  },
})
