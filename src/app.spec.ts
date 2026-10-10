import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApplication } from './application'
import worker from './worker'

const app = createApplication()
afterEach(() => vi.unstubAllGlobals())

describe('Echo Worker integration', () => {
  it('exports a Cloudflare fetch handler without starting a server', () => {
    expect(typeof worker.fetch).toBe('function')
  })

  it('shows the deployment origin without /api as the extension URL', async () => {
    const response = await app.request('https://my-saavn.workers.dev/')
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('https://my-saavn.workers.dev')
    expect(html).toContain('const baseUrl = window.location.origin;')
    expect(html).toContain('Extension Sources')
    expect(html).toContain('up to 320 kbps AAC')
  })

  it.each(['/search', '/api/search', '/stream', '/api/stream'])('mounts and validates Echo route %s', async (path) => {
    expect((await app.request(path)).status).toBe(400)
  })

  it('retains the original documented API', async () => {
    const response = await app.request('/swagger')
    const schema = await response.json()
    expect(response.status).toBe(200)
    expect(schema.paths).toHaveProperty('/api/search/songs')
    expect(schema.paths).toHaveProperty('/api/songs')
  })

  it('keeps legacy global search working with query while exposing Echo search with q', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ songs: { data: [] } }))
    )
    const legacy = await app.request('/api/search?query=test')
    expect(legacy.status).toBe(200)
    expect(await legacy.json()).toHaveProperty('success', true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ total: 0, start: 0, results: [] }))
    )
    for (const path of ['/search?q=test', '/api/search?q=test']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ tracks: [] })
    }
  })
})
