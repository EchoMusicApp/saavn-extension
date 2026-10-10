# Saavn Extension for Echo Music

Self-host a JioSaavn extension on **Cloudflare Workers**, then paste your Worker URL into Echo Music. No API key, Android changes, or audio proxy is required.

**Audio quality:** best available AAC/M4A, up to **320 kbps** when the track supports it. JioSaavn does **not** provide lossless/FLAC through this API. A client's `quality=LOSSLESS` request selects the best available lossy stream, not a converted or falsely labeled lossless file.

## Deploy with Cloudflare

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/EchoMusicApp/jiosaavn-api)

1. Click **Deploy to Cloudflare Workers** and sign in to Cloudflare/GitHub.
2. Follow Cloudflare's repository setup and deploy the Worker. No secrets or bindings are needed. If prompted for commands, use:
   - Build: `npm ci && npm run check && npm run test:echo`
   - Deploy: `npx wrangler deploy`
3. Open your deployed `https://…workers.dev` URL. The landing page displays your own extension URL; click **Copy URL**.
4. In Echo Music, open **Settings → Extension Sources → Add Custom Server**.
5. Enter **Saavn** as the name, paste that URL, save, and enable it.

Paste the **base URL**, not `/docs`, `/search`, or a song's audio link. The root URL is recommended; a base ending in `/api` also works for compatibility. Search and playback use the enabled extension through Echo's existing extension system. Availability and matching depend on JioSaavn's catalog and the client's matching logic.

### Publishing this folder as your own repository

The button above targets the existing repository URL in this project's metadata. **It will use these changes only after they are published there.** To create a different repository:

1. Put the **contents of `Saavn Extension/` at the root** of your new public GitHub repository, including `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.toml`, and `LICENSE`. Do not upload `node_modules/`, `.npm-cache/`, `.wrangler/`, or credentials.
2. Update `package.json`'s `repository`, this README's deploy-button target, and the GitHub links/logo URLs in `src/pages/home.tsx` to your repository.
3. The deploy-button target has this form (replace the example owner/repository):
   ```text
   https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_OWNER/YOUR_REPOSITORY
   ```
4. Commit and publish the repository. Users can then deploy their own copy using its button and paste their own Worker URL into Echo.

If deploying directly from the Echo Music monorepo rather than a standalone repository, set Cloudflare's **root directory** to `Saavn Extension`. The standalone layout is recommended for the deploy button.

### Deploy from your terminal

Requires Node.js 22+ and a Cloudflare account:

```sh
npm ci
npm run check
npm run test:echo
npm run deploy:check
npx wrangler login
npm run deploy
```

`deploy:check` only bundles the Worker; `deploy` publishes it. The Worker is named `jiosaavn-api` in `wrangler.toml`; change the name before deploying if you already have a different Worker using that name. For an existing deployment, redeploy the updated code to keep the same URL.

## Development

```sh
npm ci
npm run dev:worker
```

Open the local URL printed by Wrangler. For the original Bun server / Docker setup:

```sh
bun install
bun run dev
# Or: docker compose up
```

The Cloudflare entry point is `src/worker.ts`; the Bun entry point remains `src/server.ts`. Both use the same application factory. Git hooks are optional (`npm run prepare:hooks`); dependency installation does not write Git metadata.

## Echo extension API

Routes are available at the root and under `/api`. Echo responses deliberately have **no** legacy `{success, data}` wrapper.

| Endpoint                               | Response                                           |
| -------------------------------------- | -------------------------------------------------- |
| `GET /search?q=title%20artist`         | `{ "tracks": [...] }`                              |
| `GET /stream/SONG_ID?quality=LOSSLESS` | Stream metadata with a direct HTTPS audio URL      |
| `GET /stream?id=SONG_ID`               | Same response; supports Echo's older stream lookup |

Search tracks contain `id`, `title`, `artist`, `duration` (integer seconds or null), `artworkURL`, and `albumArtworkURL`. Titles and artist names have common HTML entities decoded; the largest available artwork is selected.

Example stream response:

```json
{
  "url": "https://audio.example/song_320.mp4",
  "format": "m4a",
  "quality": "320kbps",
  "streamQuality": "320kbps",
  "audioQuality": "AUDIO_QUALITY_HIGH",
  "codec": "aac"
}
```

The bitrate is chosen numerically, not by URL order; tracks without advertised 320 kbps support fall back to the highest available lower bitrate. Empty searches return `tracks: []`; invalid parameters return `400`; unavailable tracks/streams return `404`; unexpected provider errors return `502`.

Check a deployment with:

```sh
curl 'https://YOUR_WORKER.workers.dev/search?q=Arijit'
# Use an id from tracks in the response:
curl 'https://YOUR_WORKER.workers.dev/stream/SONG_ID?quality=LOSSLESS'
```

The original API remains available at `/api/search?query=...`, `/api/search/songs?query=...`, `/api/songs?ids=...`, and the album/artist/playlist routes. `/api/search?q=...` serves Echo's contract, while `/api/search?query=...` retains legacy global search. Legacy API documentation: `/docs` and `/swagger`.

## Validation

```sh
npm run check
npm run test:echo
npm run deploy:check
```

`test:echo` runs deterministic, offline adapter/helper/application tests. The broader original `npm test` suite includes live JioSaavn requests and requires network access; provider outages can fail it.

## Hosting and privacy

This is an unofficial service. Each deployment receives users' search terms and song IDs and sends requests to JioSaavn. Audio streams directly from the provider's CDN to the listener, not through your Worker. Cloudflare request limits/pricing apply; public deployments have no authentication and may be used by others. Enable appropriate Cloudflare protections if needed. Respect JioSaavn's terms, local laws, and regional availability; quality and URLs depend on the upstream provider and are not guaranteed.

## Special Thanks

| Project                                                                       | What is used                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[JioSaavn API by Sumit Kolhe](https://github.com/sumitkolhe/jiosaavn-api)** | This server is adapted from its TypeScript/Hono API, including catalog search, song/artist/album/playlist payload parsing, and media URL decryption. The Echo routes and Cloudflare entry-point changes build on that code. |

## License

[MIT](LICENSE). Preserve the upstream copyright and license when redistributing. Echo Music itself retains its separate license.
