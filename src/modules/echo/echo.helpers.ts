import type { SongService } from '../songs/services/song.service'

type Song = Awaited<ReturnType<SongService['getSongByIds']>>[number]
type Link = Song['downloadUrl'][number]

const entities: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: '\u00a0',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  middot: '·',
  bull: '•',
  eacute: 'é',
  Eacute: 'É',
  aacute: 'á',
  Aacute: 'Á',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  agrave: 'à',
  egrave: 'è',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  ntilde: 'ñ',
  ccedil: 'ç'
}

export const decodeEntities = (value: string) =>
  value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]*);/gi, (entity: string, name: string) => {
    if (!name.startsWith('#')) return Object.hasOwn(entities, name) ? entities[name] : entity

    const hex = name[1].toLowerCase() === 'x'
    const codePoint = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10)
    if (codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return entity

    return String.fromCodePoint(codePoint)
  })

const httpsUrl = (value: string): string | null => {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return null

  try {
    const url = new URL(value.trim())
    if (!url.hostname || url.username || url.password) return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

const largestImage = (images: Link[] = []): string | null => {
  if (!Array.isArray(images)) return null

  let largest = -1
  let artwork: string | null = null

  for (const image of images) {
    if (!image) continue
    const url = httpsUrl(image.url)
    if (!url) continue

    const dimensions = /^(\d+)x(\d+)$/i.exec(image.quality)
    const area = dimensions ? Number(dimensions[1]) * Number(dimensions[2]) : 0
    if (area > largest) {
      largest = area
      artwork = url
    }
  }

  return artwork
}

export const createEchoTrack = (song: Song) => {
  const artists = song.artists?.primary?.length ? song.artists.primary : song.artists?.all || []
  const artwork = largestImage(song.image)
  const duration = song.duration

  return {
    id: song.id,
    title: decodeEntities(song.name),
    artist: artists.map((artist) => decodeEntities(artist.name)).join(', '),
    duration:
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 2147483647
        ? Math.trunc(duration)
        : null,
    artworkURL: artwork,
    albumArtworkURL: artwork
  }
}

export const createEchoStream = (links: Link[] = []) => {
  if (!Array.isArray(links)) return null

  let best: {
    url: string
    kbps: number
  } | null = null

  for (const link of links) {
    if (!link || typeof link.quality !== 'string') continue
    const url = httpsUrl(link.url)
    const quality = /^(\d+)\s*kbps$/i.exec(link.quality.trim())
    const kbps = quality ? Number(quality[1]) : 0
    if (!url || !Number.isFinite(kbps) || kbps <= 0) continue
    if (!best || kbps > best.kbps) best = { url, kbps }
  }

  if (!best) return null

  const quality = `${best.kbps}kbps`
  return {
    url: best.url,
    format: 'm4a',
    quality,
    streamQuality: quality,
    audioQuality:
      best.kbps >= 256 ? 'AUDIO_QUALITY_HIGH' : best.kbps >= 128 ? 'AUDIO_QUALITY_MEDIUM' : 'AUDIO_QUALITY_LOW',
    codec: 'aac'
  }
}
