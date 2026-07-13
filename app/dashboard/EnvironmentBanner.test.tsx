import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EnvironmentBanner } from './EnvironmentBanner'

describe('EnvironmentBanner', () => {
  it('renders an unmistakable integration designation', () => {
    const html = renderToStaticMarkup(
      <EnvironmentBanner
        identity={{
          appEnvironment: 'integration',
          environmentId: 'metis-shared-integration',
          isProduction: false,
          label: 'Shared Integration — Disposable Synthetic Data',
        }}
      />
    )

    expect(html).toContain('data-environment="integration"')
    expect(html).toContain('Shared Integration — Disposable Synthetic Data')
    expect(html).toContain('metis-shared-integration')
  })

  it('renders nothing in production', () => {
    const html = renderToStaticMarkup(
      <EnvironmentBanner
        identity={{
          appEnvironment: 'production',
          environmentId: 'metis-production',
          isProduction: true,
          label: 'Production',
        }}
      />
    )

    expect(html).toBe('')
  })
})
