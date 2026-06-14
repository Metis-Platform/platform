import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'

export function getAnthropic(apiKey: string): Anthropic {
  if (!apiKey) throw new Error('Anthropic API key is required')
  return new Anthropic({ apiKey })
}

export async function resolveAnthropicKey(tenantId: string): Promise<string> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { anthropicApiKey: true },
  })
  if (!tenant?.anthropicApiKey) {
    throw new Error('Add your Anthropic API key in Settings')
  }
  return tenant.anthropicApiKey
}
