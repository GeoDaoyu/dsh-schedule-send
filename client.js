/**
 * dsh-schedule-send — browser half.
 *
 * A clock control beside the mode selector picks a wall-clock time; a thin bar
 * above the composer then turns the current draft into a one-shot task on the
 * official @deepseek-ai/dsh-schedule service (`remote.schedule.create`), so
 * nothing runs until the chosen time and no model turn is spent registering it.
 *
 * The picked time is only a staging state: the control and the bar say so, and
 * the bar's primary action ("安排发送") is the only thing that creates a task.
 * The composer's own Send keeps its normal meaning and clears the staging.
 *
 * Placement follows the public slot contract only:
 *   - `conversation.hero.options`   new-session row, after the preset control
 *   - `conversation.input.left`     composer tool row, non-blank sessions
 *   - `conversation.input.dock`     the staging bar above the card
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
    const STORAGE_PREFIX = `${NAME}:pending:`

    /* ---------------------------------------------------------------- copy */

    const zh = {
      trigger: '定时发送',
      'trigger.tooltip': '选一个时间，到点再发送输入框的内容',
      'trigger.armed': '定时发送：{when}，尚未安排',
      'picker.title': '定时发送',
      'picker.subtitle': '到点后把输入框内容作为消息发到当前会话',
      'picker.today': '今天',
      'picker.tomorrow': '明天',
      'picker.other': '其他时间',
      'picker.use': '使用此时间',
      'picker.resolved': '→ {when}',
      'picker.hint': '直接发送会立即执行；最远 24 小时',
      'bar.title': '定时发送',
      'bar.remaining': '还有 {time}',
      'bar.imminent': '还有不到 1 分钟',
      'bar.hint': '点「安排发送」才会创建任务',
      'bar.cancel': '取消',
      'bar.confirm': '安排发送',
      'bar.busy': '正在安排…',
      'bar.needDraft': '先输入要发送的内容',
      'bar.attachments': '附件不发送',
      'bar.done': '已安排在 {day} {time} 发送',
      'bar.doneHint': '可在「自动化任务」里查看或取消',
      'bar.doneAttachments': '附件没有随任务发送',
      'bar.failed': '创建失败，请重试',
      'bar.expired': '这个时间已经过了，重新选一个',
      'bar.dismiss': '关闭',
      'unit.hour': '小时',
      'unit.minute': '分钟',
    }

    const en = {
      trigger: 'Schedule send',
      'trigger.tooltip': 'Pick a time and send the composer text later',
      'trigger.armed': 'Schedule send: {when}, not scheduled yet',
      'picker.title': 'Schedule send',
      'picker.subtitle': 'Sends the text here at the chosen time',
      'picker.today': 'Today',
      'picker.tomorrow': 'Tomorrow',
      'picker.other': 'Another time',
      'picker.use': 'Use this time',
      'picker.resolved': '→ {when}',
      'picker.hint': 'Send runs it now; up to 24h ahead',
      'bar.title': 'Schedule send',
      'bar.remaining': 'in {time}',
      'bar.imminent': 'in under a minute',
      'bar.hint': 'Press Schedule to create it',
      'bar.cancel': 'Cancel',
      'bar.confirm': 'Schedule',
      'bar.busy': 'Scheduling…',
      'bar.needDraft': 'Type the message first',
      'bar.attachments': 'No attachments',
      'bar.done': 'Scheduled for {day} at {time}',
      'bar.doneHint': 'Manage or cancel it in Automation tasks',
      'bar.doneAttachments': 'Attachments were not included',
      'bar.failed': 'Could not schedule, please retry',
      'bar.expired': 'That time has passed, pick another',
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
  max-width: 190px;
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
  width: 272px;
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
.dss-preset[data-selected] {
  background: var(--dsw-alias-button-ghost-active-fill);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border);
}
.dss-preset-time { font-size: 13px; font-weight: 500; line-height: 20px; font-variant-numeric: tabular-nums; }
.dss-preset-day { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dss-sep { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dss-sep::after { flex: 1; height: 0.5px; background: var(--dsw-alias-border-l2); content: ''; }
.dss-custom { display: flex; align-items: center; gap: 6px; }
.dss-time {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
}
.dss-time:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
  border-color: var(--dsw-alias-state-business-primary);
}
.dss-use {
  flex: none;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-3);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.dss-use:disabled { opacity: 0.4; cursor: default; }
.dss-use:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dss-resolved { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
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
.dss-bar-when { flex: none; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary-dimmed); font-variant-numeric: tabular-nums; }
.dss-bar-note { flex: 1; min-width: 40px; overflow: hidden; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.dss-bar-error { flex: 1; min-width: 40px; overflow: hidden; font-size: 12px; line-height: 20px; color: var(--dsw-alias-state-error-primary); text-overflow: ellipsis; white-space: nowrap; }
.dss-bar-flag {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 120px;
  overflow: hidden;
  padding: 0 6px;
  height: 20px;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-tertiary);
  color: var(--dsw-alias-state-warn-label);
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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
.dss-ghost:disabled { opacity: 0.5; cursor: default; }
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

    /** "今天 12:00" — the form used by the trigger, the picker, and the bar. */
    function whenText(at, now, t) {
      return `${dayWord(at, now, t)} ${clockText(at)}`
    }

    /** Remaining wait as a complete phrase: "还有 49 分钟" / "in 49 min". */
    function remainingText(at, now, t) {
      const minutes = Math.round((at.getTime() - now.getTime()) / 60000)
      if (minutes < 1) return t('bar.imminent')
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      const span = hours === 0
        ? `${rest} ${t('unit.minute')}`
        : rest === 0
          ? `${hours} ${t('unit.hour')}`
          : `${hours} ${t('unit.hour')} ${rest} ${t('unit.minute')}`
      return t('bar.remaining', { time: span })
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

    /** Schedule input error code carried by a Remote failure, when present. */
    function failureCode(error) {
      if (error === null || typeof error !== 'object') return undefined
      const details = error.details
      if (details !== null && typeof details === 'object' && typeof details.code === 'string') return details.code
      return undefined
    }

    /* ------------------------------------------------ pending-time memory */

    /**
     * The staged time is not a task yet, so it lives in this page: a module
     * map for live subscribers, mirrored into sessionStorage so a refresh
     * keeps showing "not scheduled yet" instead of dropping it silently.
     */
    function readPending() {
      const next = new Map()
      try {
        const now = Date.now()
        for (let index = 0; index < sessionStorage.length; index += 1) {
          const key = sessionStorage.key(index)
          if (key === null || !key.startsWith(STORAGE_PREFIX)) continue
          const at = Number(sessionStorage.getItem(key))
          if (!Number.isFinite(at) || at <= now) {
            sessionStorage.removeItem(key)
            continue
          }
          next.set(key.slice(STORAGE_PREFIX.length), at)
        }
      } catch (_error) {
        /* A browser without sessionStorage keeps the in-memory staging only. */
      }
      return next
    }

    const pendingBySession = readPending()
    const pendingListeners = new Set()

    function notifyPending() {
      for (const listener of [...pendingListeners]) {
        try {
          listener()
        } catch (_error) {
          /* One subscriber's failure must not skip the others. */
        }
      }
    }

    function readArmed(sessionId) {
      return sessionId === undefined ? undefined : pendingBySession.get(sessionId)
    }

    function writeArmed(sessionId, at) {
      if (sessionId === undefined) return
      const previous = pendingBySession.get(sessionId)
      if (at === undefined) {
        if (previous === undefined) return
        pendingBySession.delete(sessionId)
        try { sessionStorage.removeItem(STORAGE_PREFIX + sessionId) } catch (_error) { /* memory only */ }
      } else {
        if (previous === at) return
        pendingBySession.set(sessionId, at)
        try { sessionStorage.setItem(STORAGE_PREFIX + sessionId, String(at)) } catch (_error) { /* memory only */ }
      }
      notifyPending()
    }

    /** Subscribe one component to the session's staged time. */
    function useArmed(sessionId) {
      const subscribe = useCallback(listener => {
        pendingListeners.add(listener)
        return () => { pendingListeners.delete(listener) }
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

    /** The two off-peak entry points the quick picks offer. */
    const PRESETS = [[12, 0], [18, 0]]

    /**
     * One anchored panel of quick times plus a custom wall-clock entry.
     * @param props - the trigger element, copy, staged time, and callbacks.
     */
    function TimePanel({ anchorRef, t, current, onPick, onClose }) {
      const panelRef = useRef(null)
      const firstPresetRef = useRef(null)
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
        const width = panel === null ? 272 : panel.offsetWidth
        const height = panel === null ? 260 : panel.offsetHeight
        const margin = 12
        const gap = 6
        const belowSpace = window.innerHeight - rect.bottom - gap - margin
        const aboveSpace = rect.top - gap - margin
        const fitsBelow = belowSpace >= height
        const fitsAbove = aboveSpace >= height
        // Prefer the side that holds the whole panel; never sit on the trigger.
        const openBelow = fitsBelow || (!fitsAbove && belowSpace >= aboveSpace)
        const top = openBelow ? rect.bottom + gap : Math.max(margin, rect.top - gap - height)
        const maxHeight = Math.max(120, openBelow ? belowSpace : aboveSpace)
        // A trigger near the right edge end-aligns the panel, as host pickers do.
        const startAligned = Math.max(margin, rect.left)
        const endAligned = Math.min(rect.right - width, window.innerWidth - width - margin)
        const left = startAligned + width > window.innerWidth - margin
          ? Math.max(margin, endAligned)
          : startAligned
        setPosition({ top: Math.max(margin, top), left, maxHeight })
      }, [anchorRef])

      useLayoutEffect(() => { place() }, [place])

      useEffect(() => { place() }, [custom, place])

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
        // Keyboard users land inside the panel; Escape hands focus back.
        if (firstPresetRef.current !== null) firstPresetRef.current.focus()
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
          if (anchorRef.current !== null) anchorRef.current.focus()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [anchorRef, onClose])

      const commit = useCallback(at => {
        onPick(at)
        onClose()
        if (anchorRef.current !== null) anchorRef.current.focus()
      }, [anchorRef, onClose, onPick])

      const now = new Date()
      const customAt = fromTimeInput(custom, now)

      return createPortal(
        h('div', {
          ref: panelRef,
          className: 'dss-panel',
          role: 'dialog',
          'aria-label': t('picker.title'),
          style: position === undefined
            ? { top: -10000, left: -10000 }
            : { top: position.top, left: position.left, maxHeight: position.maxHeight, overflowY: 'auto' },
        },
        h('div', null,
          h('div', { className: 'dss-panel-title' }, t('picker.title')),
          h('div', { className: 'dss-panel-sub' }, t('picker.subtitle')),
        ),
        h('div', { className: 'dss-presets' }, PRESETS.map(([hour, minute], index) => {
          const at = nextOccurrence(hour, minute, now)
          const selected = current !== undefined && Math.abs(current - at.getTime()) < 60000
          return h('button', {
            key: `${hour}:${minute}`,
            ref: index === 0 ? firstPresetRef : undefined,
            type: 'button',
            className: 'dss-preset',
            'data-selected': selected ? '' : undefined,
            'aria-pressed': selected,
            onClick: () => { commit(at.getTime()) },
          },
          h('span', { className: 'dss-preset-time' }, clockText(at)),
          h('span', { className: 'dss-preset-day' }, dayWord(at, now, t)))
        })),
        h('div', { className: 'dss-sep' }, t('picker.other')),
        h('div', { className: 'dss-custom' },
          h('input', {
            className: 'dss-time',
            type: 'time',
            step: 60,
            value: custom,
            'aria-label': t('picker.other'),
            onChange: event => { setCustom(event.target.value) },
            onKeyDown: event => {
              if (event.key !== 'Enter' || customAt === undefined) return
              event.preventDefault()
              commit(customAt.getTime())
            },
          }),
          h('button', {
            type: 'button',
            className: 'dss-use',
            disabled: customAt === undefined,
            onClick: () => { if (customAt !== undefined) commit(customAt.getTime()) },
          }, t('picker.use'))),
        customAt === undefined
          ? null
          : h('div', { className: 'dss-resolved' },
            t('picker.resolved', { when: whenText(customAt, now, t) })),
        h('div', { className: 'dss-hint' }, t('picker.hint'))),
        document.body,
      )
    }

    /* ------------------------------------------------------------- trigger */

    /**
     * The clock control: shows the staged time, and opens the time panel.
     * @param props - standard Session props plus the placement variant.
     */
    function ClockTrigger({ t, sessionId, variant }) {
      const armed = useArmed(sessionId)
      const [open, setOpen] = useState(false)
      const anchorRef = useRef(null)

      useEffect(() => { setOpen(false) }, [sessionId])

      const now = new Date()
      const when = armed === undefined ? undefined : whenText(new Date(armed), now, t)
      const label = when === undefined ? t('trigger') : when

      return h('div', { className: 'dss-root' },
        h('button', {
          ref: anchorRef,
          type: 'button',
          className: 'dss-trigger',
          'data-variant': variant,
          'data-armed': armed === undefined ? undefined : '',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-label': when === undefined ? t('trigger') : t('trigger.armed', { when }),
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

    /* ------------------------------------------------------- staging bar */

    /**
     * The staging bar above the composer card: stages, cancels, and reports.
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
      const [, setTick] = useState(0)
      const dismissTimer = useRef(undefined)
      const submitLock = useRef(false)

      useEffect(() => () => {
        if (dismissTimer.current !== undefined) clearTimeout(dismissTimer.current)
      }, [])

      useEffect(() => { setFailure(undefined) }, [armed])

      // A new staged time replaces the previous success/error report.
      useEffect(() => {
        if (armed === undefined) return
        setDone(undefined)
      }, [armed])

      useEffect(() => { setDone(undefined) }, [sessionId])

      // Keep the remaining-time copy live and notice the moment the time passes.
      useEffect(() => {
        if (armed === undefined) return undefined
        const timer = setInterval(() => { setTick(value => value + 1) }, 30000)
        return () => { clearInterval(timer) }
      }, [armed])

      // Sending the draft now consumes the text the staging was meant for.
      useEffect(() => {
        if (phase !== 'sending' && phase !== 'submitting') return
        writeArmed(sessionId, undefined)
      }, [phase, sessionId])

      const submit = useCallback(async () => {
        const text = draft.trim()
        if (text === '' || armed === undefined || submitLock.current) return
        if (armed <= Date.now()) {
          setFailure({ text: t('bar.expired') })
          return
        }
        submitLock.current = true
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
            const code = failureCode(result.error)
            setFailure({
              text: code === 'not_future' ? t('bar.expired') : t('bar.failed'),
              detail: failureText(result.error),
            })
            if (code === 'not_future') writeArmed(sessionId, undefined)
            return
          }
          inputActions.setDraft('')
          writeArmed(sessionId, undefined)
          setDone({ at, attachments: attachments > 0 })
          if (dismissTimer.current !== undefined) clearTimeout(dismissTimer.current)
          dismissTimer.current = setTimeout(() => { setDone(undefined) }, 10000)
        } catch (error) {
          setFailure({ text: t('bar.failed'), detail: failureText(error) })
        } finally {
          submitLock.current = false
          setBusy(false)
        }
      }, [armed, attachments, ctx, draft, inputActions, sessionId, t])

      if (done !== undefined) {
        return h('div', { className: 'dss-dock' },
          h('div', { className: 'dss-bar', role: 'status' },
            h('span', { className: 'dss-bar-icon', 'data-state': 'done' }, h(CheckIcon, { size: 14 })),
            h('span', { className: 'dss-bar-label' },
              t('bar.done', { day: dayWord(done.at, new Date(), t), time: clockText(done.at) })),
            h('span', { className: 'dss-bar-note' },
              done.attachments ? t('bar.doneAttachments') : t('bar.doneHint')),
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
      const now = new Date()
      const empty = draft.trim() === ''
      const expired = armed <= now.getTime()

      return h('div', { className: 'dss-dock' },
        h('div', { className: 'dss-bar', role: 'group', 'aria-label': t('bar.title') },
          h('span', { className: 'dss-bar-icon' }, h(ClockIcon, { size: 14 })),
          h('span', { className: 'dss-bar-label' }, t('bar.title')),
          h('span', { className: 'dss-bar-when' },
            expired ? whenText(at, now, t) : `${whenText(at, now, t)} · ${remainingText(at, now, t)}`),
          failure !== undefined
            ? h('span', {
              className: 'dss-bar-error',
              role: 'alert',
              title: failure.detail,
            }, failure.text)
            : h('span', { className: 'dss-bar-note', id: `${NAME}-note` },
              expired ? t('bar.expired') : empty ? t('bar.needDraft') : t('bar.hint')),
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
              disabled: busy || empty || expired,
              'aria-busy': busy,
              'aria-describedby': `${NAME}-note`,
              onClick: submit,
            }, busy ? t('bar.busy') : t('bar.confirm')))))
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
