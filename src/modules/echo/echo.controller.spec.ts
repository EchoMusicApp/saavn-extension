import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Echo } from './index'
import type { Context } from 'hono'

const services = vi.hoisted(() => ({
  searchSongs: vi.fn(),
  getSongByIds: vi.fn()
}))

vi.mock('../search/services/search.service', () => ({
  SearchService: class {
    searchSongs = services.searchSongs
  }
}))

vi.mock('../songs/services/song.service', () => ({
  SongService: class {
    getSongByIds = services.getSongByIds
  }
}))

const song = (overrides: Record<string, unknown> = {}) => ({
  id: 'Ab_12-Z',
  name: 'Rock &amp; Roll &quot;Live&quot; &#x1F3B5; &#233;',
  duration: 203.9,
  artists: {
    primary: [{ name: 'A &amp; B' }, { name: 'L&apos;Artiste &#128512;' }],
    all: [{ name: 'Other artist' }]
  },
  image: [
    { quality: '150x150', url: 'https://images.example/150.jpg' },
    { quality: '500x500', url: 'http://images.example/500.jpg' },
    { quality: '50x50', url: 'https://images.example/50.jpg' }
  ],
  downloadUrl: [
    { quality: '96kbps', url: 'https://audio.example/96.m4a' },
    { quality: '320kbps', url: 'http://audio.example/320.m4a' },
    { quality: '160kbps', url: 'https://audio.example/160.m4a' }
  ],
  ...overrides
})

const highStream = {
  url: 'https://audio.example/320.m4a',
  format: 'm4a',
  quality: '320kbps',
  streamQuality: '320kbps',
  audioQuality: 'AUDIO_QUALITY_HIGH',
  codec: 'aac'
}

beforeEach(() => {
  vi.resetAllMocks()
  services.searchSongs.mockResolvedValue({ total: 1, start: 0, results: [song()] })
  services.getSongByIds.mockResolvedValue([song()])
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network access is forbidden in Echo offline tests')
    })
  )
})

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})

describe('Echo search contract', () => {
  it('returns Kotlin track fields, decoded metadata, integer seconds and the largest image', async () => {
    const response = await Echo.request('/search?q=%20rock%20%26%20roll%20')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      tracks: [
        {
          id: 'Ab_12-Z',
          title: 'Rock & Roll "Live" 🎵 é',
          artist: "A & B, L'Artiste 😀",
          duration: 203,
          artworkURL: 'https://images.example/500.jpg',
          albumArtworkURL: 'https://images.example/500.jpg'
        }
      ]
    })
    expect(services.searchSongs).toHaveBeenCalledExactlyOnceWith({ query: 'rock & roll', page: 0, limit: 20 })
    expect(services.getSongByIds).not.toHaveBeenCalled()
  })

  it('decodes common entities and Unicode, preserving invalid, unknown and nested entities', async () => {
    services.searchSongs.mockResolvedValue({
      results: [
        song({
          name: '&lt;Live&gt;&nbsp;&ndash;&mdash;&hellip;&lsquo;Hi&rsquo; &copy; &eacute; &#X1f600; &#0; &#xD800; &#1114112; &unknown; &amp;lt;',
          artists: { primary: [], all: [{ name: 'Artist &#x1F3B6; &ldquo;Mix&rdquo;' }] }
        })
      ]
    })

    const { tracks } = await (await Echo.request('/search?q=live')).json()
    expect(tracks[0].title).toBe('<Live>\u00a0–—…‘Hi’ © é 😀 &#0; &#xD800; &#1114112; &unknown; &lt;')
    expect(tracks[0].artist).toBe('Artist 🎶 “Mix”')
  })

  it('uses nulls for unavailable artwork and metadata without inventing values', async () => {
    services.searchSongs.mockResolvedValue({ results: [song({ duration: null, image: [], artists: {} })] })

    const { tracks } = await (await Echo.request('/search?q=live')).json()
    expect(tracks[0]).toMatchObject({ duration: null, artworkURL: null, albumArtworkURL: null, artist: '' })
  })

  it.each([NaN, Infinity, -1, 2147483648, '203', undefined])(
    'returns null for invalid duration %s',
    async (duration) => {
      services.searchSongs.mockResolvedValue({ results: [song({ duration })] })

      const { tracks } = await (await Echo.request('/search?q=live')).json()
      expect(tracks[0].duration).toBeNull()
    }
  )

  it.each([0, 2147483647])('preserves valid Kotlin Int boundary %s', async (duration) => {
    services.searchSongs.mockResolvedValue({ results: [song({ duration })] })

    const { tracks } = await (await Echo.request('/search?q=live')).json()
    expect(tracks[0].duration).toBe(duration)
  })

  it('ignores invalid images and compares pixel area, not list order', async () => {
    services.searchSongs.mockResolvedValue({
      results: [
        song({
          image: [
            { quality: '1000x1000', url: 'javascript:alert(1)' },
            { quality: '500x500', url: 'https://images.example/square.jpg' },
            { quality: '900x100', url: 'https://images.example/wide.jpg' }
          ]
        })
      ]
    })

    const { tracks } = await (await Echo.request('/search?q=live')).json()
    expect(tracks[0].artworkURL).toBe('https://images.example/square.jpg')
  })

  it('returns an empty tracks array for no search matches', async () => {
    services.searchSongs.mockResolvedValue({ total: 0, start: 0, results: [] })

    const response = await Echo.request('/search?q=unmatched')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tracks: [] })
  })

  it.each(['/search', '/search?q=', '/search?q=%20%09%0A', '/search?query=wrong'])(
    'rejects missing or blank q: %s',
    async (path) => {
      const response = await Echo.request(path)
      expect(response.status).toBe(400)
      expect(services.searchSongs).not.toHaveBeenCalled()
    }
  )
})

describe('Echo stream contract', () => {
  it.each([
    '/stream/Ab_12-Z?quality=320kbps',
    '/stream?id=Ab_12-Z',
    '/stream?id=Ab_12-Z&quality=320kbps',
    '/stream/Ab_12-Z?quality=96kbps',
    '/stream?id=Ab_12-Z&quality=UNKNOWN'
  ])('ignores quality queries and returns the best AAC stream without a provider envelope: %s', async (path) => {
    const response = await Echo.request(path)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(highStream)
    expect(services.getSongByIds).toHaveBeenCalledExactlyOnceWith({ songIds: 'Ab_12-Z' })
    expect(services.searchSongs).not.toHaveBeenCalled()
  })

  it('uses the path ID rather than allowing the query ID to override it', async () => {
    const response = await Echo.request('/stream/Ab_12-Z?id=other')
    expect(response.status).toBe(200)
    expect(services.getSongByIds).toHaveBeenCalledExactlyOnceWith({ songIds: 'Ab_12-Z' })
  })

  it.each([
    [320, 'AUDIO_QUALITY_HIGH'],
    [160, 'AUDIO_QUALITY_MEDIUM'],
    [96, 'AUDIO_QUALITY_LOW'],
    [48, 'AUDIO_QUALITY_LOW'],
    [12, 'AUDIO_QUALITY_LOW']
  ])('reports the actual fallback bitrate %s and audio classification %s', async (kbps, audioQuality) => {
    services.getSongByIds.mockResolvedValue([
      song({ downloadUrl: [{ quality: `${kbps}kbps`, url: `https://audio.example/${kbps}.m4a` }] })
    ])

    const response = await Echo.request('/stream/Ab_12-Z?quality=320kbps')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      url: `https://audio.example/${kbps}.m4a`,
      format: 'm4a',
      quality: `${kbps}kbps`,
      streamQuality: `${kbps}kbps`,
      audioQuality,
      codec: 'aac'
    })
  })

  it('orders bitrate numerically and skips invalid higher-quality entries', async () => {
    services.getSongByIds.mockResolvedValue([
      song({
        downloadUrl: [
          { quality: '320kbps', url: 'javascript:alert(1)' },
          { quality: '320kbps', url: 'https://' },
          { quality: '320kbps', url: 'https://user:secret@audio.example/320.m4a' },
          { quality: '96kbps', url: 'https://audio.example/96.m4a' },
          { quality: '160 KBPS', url: 'http://audio.example/160.m4a' },
          { quality: 'UNKNOWN', url: 'https://audio.example/unknown.m4a' },
          { quality: '0kbps', url: 'https://audio.example/zero.m4a' }
        ]
      })
    ])

    const response = await Echo.request('/stream?id=Ab_12-Z')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      url: 'https://audio.example/160.m4a',
      quality: '160kbps',
      streamQuality: '160kbps',
      audioQuality: 'AUDIO_QUALITY_MEDIUM'
    })
  })

  it.each(
    [
      undefined,
      null,
      [],
      [null],
      [{ url: 'https://audio.example/song.m4a' }],
      [{ quality: '320kbps', url: '' }],
      [{ quality: '320kbps', url: 'ftp://audio.example/song.m4a' }],
      [{ quality: '320kbps', url: '//audio.example/song.m4a' }],
      [{ quality: 'unknown', url: 'https://audio.example/song.m4a' }],
      [{ quality: '-1kbps', url: 'https://audio.example/song.m4a' }]
    ].map((downloadUrl) => ({ downloadUrl }))
  )('returns 404 for absent or invalid download URLs: %j', async ({ downloadUrl }) => {
    services.getSongByIds.mockResolvedValue([song({ downloadUrl })])

    const response = await Echo.request('/stream/Ab_12-Z')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ message: 'No playable Saavn stream found' })
  })

  it.each([{ songs: [] }, { songs: [song({ id: 'different' })] }])(
    'returns 404 for missing or mismatched songs: %j',
    async ({ songs }) => {
      services.getSongByIds.mockResolvedValue(songs)

      const response = await Echo.request('/stream?id=Ab_12-Z')
      expect(response.status).toBe(404)
    }
  )

  it.each([
    '/stream',
    '/stream?id=',
    '/stream?id=%20%09',
    '/stream?id=first,second',
    '/stream?id=https%3A%2F%2Faudio.example%2Fsong.m4a',
    '/stream?id=bad%2Fid',
    '/stream?id=bad%26id',
    '/stream/%2E%2E%2Fsecret',
    '/stream/id%00',
    `/stream?id=${'a'.repeat(65)}`,
    '/stream?url=https%3A%2F%2Faudio.example%2Fsong.m4a'
  ])('rejects unsafe, missing, blank or multiple IDs: %s', async (path) => {
    const response = await Echo.request(path)
    expect(response.status).toBe(400)
    expect(services.getSongByIds).not.toHaveBeenCalled()
  })

  it('accepts the maximum safe ID length', async () => {
    const id = 'a'.repeat(64)
    services.getSongByIds.mockResolvedValue([song({ id })])

    const response = await Echo.request(`/stream/${id}`)
    expect(response.status).toBe(200)
    expect(services.getSongByIds).toHaveBeenCalledExactlyOnceWith({ songIds: id })
  })
})

describe('Echo errors and parent mounting', () => {
  it.each(['/search?q=test', '/stream/Ab_12-Z', '/stream?id=Ab_12-Z'])(
    'preserves expected HTTPException statuses for %s',
    async (path) => {
      const error = new HTTPException(429, { message: 'Provider rate limited' })
      services.searchSongs.mockRejectedValue(error)
      services.getSongByIds.mockRejectedValue(error)

      const response = await Echo.request(path)
      expect(response.status).toBe(429)
      expect(await response.json()).toEqual({ message: 'Provider rate limited' })
    }
  )

  it('preserves provider song-not-found errors', async () => {
    services.getSongByIds.mockRejectedValue(new HTTPException(404, { message: 'song not found' }))

    const response = await Echo.request('/stream?id=Ab_12-Z')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ message: 'song not found' })
  })

  it.each([{ status: 503 }, { statusCode: 401 }])('preserves structured provider error %j', async (properties) => {
    services.searchSongs.mockRejectedValue(Object.assign(new Error('Provider error'), properties))

    const response = await Echo.request('/search?q=test')
    expect(response.status).toBe('status' in properties ? properties.status : properties.statusCode)
  })

  it.each(['/search?q=test', '/stream/Ab_12-Z', '/stream?id=Ab_12-Z'])(
    'maps unexpected provider failures to 502 for %s',
    async (path) => {
      const error = new Error('Private upstream details')
      services.searchSongs.mockRejectedValue(error)
      services.getSongByIds.mockRejectedValue(error)

      const response = await Echo.request(path)
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ message: 'Saavn provider request failed' })
    }
  )

  it.each([200, 399, 600, 404.5, '404'])('does not preserve invalid error status %s', async (status) => {
    services.searchSongs.mockRejectedValue(Object.assign(new Error('Invalid status'), { status }))

    expect((await Echo.request('/search?q=test')).status).toBe(502)
  })

  it('falls through only for legacy /api/search requests with query present and q absent', async () => {
    const parent = new Hono()
    parent.route('/', Echo)
    parent.route('/api', Echo)
    const legacy = vi.fn((ctx: Context) => ctx.json({ success: true, data: 'Legacy search' }))
    parent.get('/api/search', legacy)

    for (const path of ['/api/search?query=test', '/api/search?query=']) {
      const response = await parent.request(path)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, data: 'Legacy search' })
    }
    expect(legacy).toHaveBeenCalledTimes(2)
    expect(services.searchSongs).not.toHaveBeenCalled()

    for (const path of ['/search?query=test', '/api/search', '/api/search?q=&query=test']) {
      expect((await parent.request(path)).status).toBe(400)
    }
    expect(legacy).toHaveBeenCalledTimes(2)
    expect(services.searchSongs).not.toHaveBeenCalled()

    const response = await parent.request('/api/search?q=echo&query=legacy')
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveProperty('tracks')
    expect(services.searchSongs).toHaveBeenCalledExactlyOnceWith({ query: 'echo', page: 0, limit: 20 })
    expect(legacy).toHaveBeenCalledTimes(2)
  })

  it('can be mounted at / and /api with router-local errors, before legacy routes', async () => {
    const parent = new Hono()
    parent.onError((_, ctx) => ctx.json({ message: 'Parent error' }, 500))
    parent.route('/', Echo)
    parent.route('/api', Echo)
    parent.get('/api/search', (ctx) => ctx.json({ success: true, data: 'Legacy search' }))

    for (const prefix of ['', '/api']) {
      const search = await parent.request(`${prefix}/search?q=test`)
      expect(search.status).toBe(200)
      expect(await search.json()).toHaveProperty('tracks')

      for (const path of ['/stream/Ab_12-Z?quality=320kbps', '/stream?id=Ab_12-Z']) {
        const response = await parent.request(`${prefix}${path}`)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(highStream)
      }

      expect((await parent.request(`${prefix}/search?q=`)).status).toBe(400)
      services.getSongByIds.mockRejectedValueOnce(new Error('Provider unavailable'))
      expect((await parent.request(`${prefix}/stream?id=Ab_12-Z`)).status).toBe(502)
    }
  })
})
