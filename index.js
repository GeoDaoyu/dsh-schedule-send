/**
 * Host half of dsh-schedule-send.
 *
 * The plugin owns no Host state: the browser half reads the composer and calls
 * the Schedule service's Remote `create` method, so the task is created without
 * a model turn. Declaring `schedule` keeps this row inactive, and therefore the
 * composer control absent, on a Host that has no Schedule service.
 */

/** Wait for the official Schedule service before activating. */
export const inject = ['schedule']

/** Nothing to install on the Host; the browser bundle owns the whole feature. */
export function apply() {}
