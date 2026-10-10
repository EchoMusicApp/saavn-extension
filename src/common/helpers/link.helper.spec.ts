import crypto from 'node-forge'
import { describe, expect, it } from 'vitest'
import { createDownloadLinks } from './link.helper'
import { createSongPayload } from '../../modules/songs/helpers/song.helper'
import type { SongAPIResponseModel } from '../../modules/songs/models'
import type { z } from 'zod'

const encryptedUrl = () => {
  const cipher = crypto.cipher.createCipher('DES-ECB', crypto.util.createBuffer('38346591'))
  cipher.start({ iv: crypto.util.createBuffer('00000000') })
  cipher.update(crypto.util.createBuffer('http://audio.example/song_96.mp4'))
  cipher.finish()
  return crypto.util.encode64(cipher.output.getBytes())
}

describe('Saavn download availability', () => {
  it('preserves all five bitrates for the legacy helper default', () => {
    const links = createDownloadLinks(encryptedUrl())
    expect(links.map((link) => link.quality)).toEqual(['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'])
    expect(links[4].url).toBe('http://audio.example/song_320.mp4')
  })

  it('does not invent 320 kbps when the provider does not advertise it', () => {
    expect(createDownloadLinks(encryptedUrl(), false).map((link) => link.quality)).toEqual([
      '12kbps',
      '48kbps',
      '96kbps',
      '160kbps'
    ])
  })

  it.each(['true', 'false', undefined])('honors the provider 320kbps flag %s in song payloads', (flag) => {
    const raw = {
      id: 'song1',
      title: 'Song',
      image: '',
      more_info: { encrypted_media_url: encryptedUrl(), '320kbps': flag }
    } as unknown as z.infer<typeof SongAPIResponseModel>
    const links = createSongPayload(raw).downloadUrl
    expect(links.some((link) => link.quality === '320kbps')).toBe(flag === 'true')
  })

  it('returns no links for missing media', () => {
    expect(createDownloadLinks('', false)).toEqual([])
  })
})
