import { NextResponse } from 'next/server'
import {
  assertSideEffectAllowed,
  type GuardedSideEffect,
  type RuntimeEnvironment,
} from './side-effect-policy'

export function guardCronRequest(
  request: Request,
  options: {
    env?: RuntimeEnvironment
    requiredSideEffects?: GuardedSideEffect[]
  } = {}
): NextResponse | null {
  const env = options.env ?? process.env
  const authorization = request.headers.get('authorization')
  if (!env.CRON_SECRET || authorization !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    assertSideEffectAllowed('cron', env)
    for (const sideEffect of options.requiredSideEffects ?? []) {
      assertSideEffectAllowed(sideEffect, env)
    }
    return null
  } catch {
    console.warn('[side-effect-policy] scheduled execution skipped')
    return NextResponse.json({
      skipped: true,
      reason: 'disabled_by_environment_policy',
    })
  }
}
