import { createHash } from 'node:crypto'

import { neon } from '@neondatabase/serverless'

import { HELP_DAILY_LIMIT } from '../../src/common/appGuide.js'
import { neonConnectionString } from './env.js'

/** Questions per day across every signed-out visitor: the ceiling on what /api/help can spend. */
export const HELP_GLOBAL_DAILY_LIMIT = Number(process.env.HELP_GLOBAL_DAILY_LIMIT) || 300

const GLOBAL_KEY = '*'

/** The caller's IP as Vercel reports it, hashed so the table never holds an address. */
export function clientIpHash(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers['x-real-ip'] ?? headers['x-forwarded-for'] ?? ''
  const ip = (Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim() || 'unknown'
  return createHash('sha256').update(`daybook-help:${ip}`).digest('hex').slice(0, 32)
}

export type HelpQuota = { allowed: true; remaining: number } | { allowed: false; reason: 'user' | 'global' }

/**
 * Count one question against the caller's day and the deployment's day, then say whether it may be
 * answered. Counting first (atomically, in one statement each) means parallel requests can't slip past
 * the limit. A refused question still counts, so retrying in a loop gains nothing.
 */
export async function takeHelpQuota(ipHash: string): Promise<HelpQuota> {
  const sql = neon(neonConnectionString())
  const bump = async (key: string) => {
    const rows = (await sql`
      insert into public.help_usage (ip_hash, day, count)
      values (${key}, (now() at time zone 'utc')::date, 1)
      on conflict (ip_hash, day) do update set count = public.help_usage.count + 1
      returning count
    `) as Array<{ count: number }>
    return rows[0].count
  }

  const used = await bump(ipHash)
  if (used > HELP_DAILY_LIMIT) return { allowed: false, reason: 'user' }
  if ((await bump(GLOBAL_KEY)) > HELP_GLOBAL_DAILY_LIMIT) return { allowed: false, reason: 'global' }
  return { allowed: true, remaining: HELP_DAILY_LIMIT - used }
}
