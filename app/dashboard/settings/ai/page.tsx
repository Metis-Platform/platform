import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AiKeyForm from './AiKeyForm'

export default async function AiSettingsPage() {
  const result = await getCurrentUser()
  if (!result) redirect('/sign-in')

  const { tenant } = result
  const hasKey = !!tenant.anthropicApiKey

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect your Anthropic API key to enable document extraction and Deal Copilot.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Anthropic API Key</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Your key is stored securely and used only for your account. Metis never uses a platform key for your requests.
          Get a key at{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            console.anthropic.com
          </a>.
        </p>
        <AiKeyForm hasKey={hasKey} />
      </div>
    </div>
  )
}
