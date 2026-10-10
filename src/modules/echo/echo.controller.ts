import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { SearchService } from '../search/services/search.service'
import { SongService } from '../songs/services/song.service'
import { createEchoStream, createEchoTrack } from './echo.helpers'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

const searchService = new SearchService()
const songService = new SongService()

export const Echo = new Hono()

Echo.onError((error, ctx) => {
  const status = 'status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599) {
    return ctx.json({ message: error.message || 'Provider request failed' }, status as ContentfulStatusCode)
  }

  return ctx.json({ message: 'Saavn provider request failed' }, 502)
})

Echo.get('/search', async (ctx, next) => {
  const q = ctx.req.query('q')
  if (ctx.req.path === '/api/search' && q === undefined && ctx.req.query('query') !== undefined) {
    return next()
  }

  const query = q?.trim()
  if (!query) throw new HTTPException(400, { message: 'A non-empty q query parameter is required' })

  const result = await searchService.searchSongs({ query, page: 0, limit: 20 })
  return ctx.json({ tracks: result.results.map(createEchoTrack) })
})

const stream = async (ctx: Context) => {
  const id = (ctx.req.param('id') ?? ctx.req.query('id'))?.trim()
  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw new HTTPException(400, { message: 'A single valid Saavn song id is required (1–64 letters, digits, _ or -)' })
  }

  const songs = await songService.getSongByIds({ songIds: id })
  const song = songs.find((candidate) => candidate.id === id)
  const payload = song ? createEchoStream(song.downloadUrl) : null
  if (!payload) throw new HTTPException(404, { message: 'No playable Saavn stream found' })

  // Quality query parameters are ignored in favor of the best available AAC bitrate.
  return ctx.json(payload)
}

Echo.get('/stream', stream)
Echo.get('/stream/:id', stream)
