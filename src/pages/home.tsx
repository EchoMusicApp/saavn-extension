import { Hono } from 'hono'

export const Home = new Hono()

Home.get('/', (c) => {
  const title = 'Saavn Extension · Echo Music'
  const extensionUrl = new URL(c.req.url).origin
  const description =
    'JioSaavn API is an unofficial wrapper written in TypeScript for jiosaavn.com providing programmatic access to a vast library of songs, albums, artists, playlists, and more.'

  return c.html(
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={extensionUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={extensionUrl} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />

        <link
          rel="icon"
          type="image/png"
          href="https://raw.githubusercontent.com/EchoMusicApp/saavn-extension/main/assets/Echo-White.png"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
        :root {
            --bg: #000000;
            --card-bg: #0a0a0a;
            --border: #1f1f1f;
            --text: #ffffff;
            --text-muted: #8c8c8c;
            --primary: #ffffff;
            --primary-text: #000000;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            width: 100%;
            max-width: 460px;
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 36px 32px;
            text-align: center;
        }

        .logo-container {
            width: 56px;
            height: 56px;
            margin: 0 auto 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #121212;
            border: 1px solid var(--border);
            border-radius: 12px;
        }

        h1 {
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: -0.01em;
        }

        .subtitle {
            font-size: 0.88rem;
            color: var(--text-muted);
            margin-bottom: 24px;
            line-height: 1.4;
        }

        .url-field {
            display: flex;
            gap: 8px;
            margin-bottom: 28px;
            text-align: left;
        }

        .url-input {
            flex: 1;
            background: #121212;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 14px;
            font-family: monospace;
            font-size: 0.82rem;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            user-select: all;
        }

        .copy-btn {
            background-color: var(--primary);
            color: var(--primary-text);
            border: none;
            border-radius: 8px;
            padding: 0 16px;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.1s ease;
            white-space: nowrap;
        }

        .copy-btn:hover {
            opacity: 0.9;
        }

        .copy-btn:active {
            opacity: 0.8;
        }

        .instructions-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-bottom: 16px;
            border-top: 1px solid var(--border);
            padding-top: 24px;
            text-align: left;
        }

        .steps {
            display: flex;
            flex-direction: column;
            gap: 12px;
            list-style: none;
            text-align: left;
        }

        .step {
            display: flex;
            gap: 12px;
            font-size: 0.88rem;
            line-height: 1.5;
            align-items: center;
        }

        .step-number {
            font-weight: 600;
            color: var(--text-muted);
            min-width: 18px;
        }

        .step-text {
            color: #d1d1d1;
            flex: 1;
        }

        .highlight {
            color: var(--text);
            font-weight: 500;
        }

        a {
            color: inherit;
            text-decoration: none;
            transition: color 0.1s ease;
        }

        a:hover .highlight {
            color: #ff7d78;
        }
            `
          }}
        />
      </head>
      <body>
        <div class="container">
          <div class="logo-container">
            <img
              src="https://raw.githubusercontent.com/EchoMusicApp/saavn-extension/main/assets/Echo-White.png"
              alt="Echo Music Logo"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
          </div>
          <h1>Saavn Extension</h1>
          <p class="subtitle">Ready for Echo Music. Stream the best available JioSaavn audio, up to 320 kbps AAC.</p>

          <div class="url-field">
            <div class="url-input" id="base-url">
              {extensionUrl}
            </div>
            <button class="copy-btn" id="copy-btn" type="button" aria-live="polite" onclick="copyUrl()">
              Copy URL
            </button>
          </div>

          <div class="instructions-title">Connect to Echo Music</div>
          <ol class="steps">
            <li class="step">
              <span class="step-number">1.</span>
              <span class="step-text">Open Settings → Extension Sources → Add Custom Server.</span>
            </li>
            <li class="step">
              <span class="step-number">2.</span>
              <span class="step-text">Name it Saavn, paste the URL above, and save.</span>
            </li>
            <li class="step">
              <span class="step-number">3.</span>
              <span class="step-text">Enable the extension and play a track available on JioSaavn.</span>
            </li>
          </ol>
          <div class="instructions-title">Quick Links</div>
          <ol class="steps">
            <li class="step">
              <span class="step-number">1.</span>
              <span class="step-text">
                <a href="/docs">
                  Explore the <span class="highlight">API Documentation</span>
                </a>
              </span>
            </li>
            <li class="step">
              <span class="step-number">2.</span>
              <span class="step-text">
                <a href="https://github.com/EchoMusicApp/saavn-extension" target="_blank" rel="noopener noreferrer">
                  View source on <span class="highlight">GitHub</span>
                </a>
              </span>
            </li>
            <li class="step">
              <span class="step-number">3.</span>
              <span class="step-text">
                <a
                  href="https://github.com/EchoMusicApp/saavn-extension/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Report an <span class="highlight">Issue</span>
                </a>
              </span>
            </li>
          </ol>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            const baseUrl = window.location.origin;
            document.getElementById('base-url').textContent = baseUrl;

            async function copyUrl() {
                const btn = document.getElementById('copy-btn');
                try {
                    await navigator.clipboard.writeText(baseUrl);
                    btn.textContent = 'Copied';
                    setTimeout(function() {
                        btn.textContent = 'Copy URL';
                    }, 2000);
                } catch {
                    btn.textContent = 'Select URL to copy';
                }
            }
            `
          }}
        />
      </body>
    </html>
  )
})
