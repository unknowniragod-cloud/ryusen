# Ryusen Cloud Browser (free-tier foundation)

This Worker creates an on-demand Cloudflare Browser Run session and returns its Live Inspector URL to the Ryusen mobile dashboard. It does **not** yet run the AutoEverything generation queue.

## What this first milestone does

- Health-checks the Worker configuration.
- Authenticates requests from the Ryusen dashboard with a private access key.
- Creates a Cloudflare Browser Run session with a 10-minute keep-alive.
- Returns the Cloudflare inspector URL so the user can open the remote browser and sign in to Google Flow.

## Free-tier limit

Cloudflare Workers Free currently includes 10 minutes of Browser Run browser time per day and up to 3 concurrent browser sessions. This is for compatibility/login testing, not unlimited video generation. See https://developers.cloudflare.com/browser-run/pricing/.

## Deploy

1. Create a Cloudflare account and copy the Account ID from the dashboard.
2. Create an API token with:
   - Account / Browser Rendering / Edit
   - Account / Workers Scripts / Edit
   - Account / Account Settings / Read
3. In GitHub, open **Settings → Secrets and variables → Actions** for this repository and add:
   - `CLOUDFLARE_API_TOKEN` — the API token above
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare Account ID
   - `RYUSEN_ACCESS_KEY` — a long random private key you choose
4. Run the **Deploy Ryusen Cloud Browser** workflow from the Actions tab, or push a change under `cloudflare-worker/`.
5. The Worker URL will be `https://ryusen-browser-worker.<your-workers-subdomain>.workers.dev`.
6. Open the Ryusen app, switch to **Cloud Browser**, enter the Worker URL and the same `RYUSEN_ACCESS_KEY`, then save settings.

Do not put the Cloudflare API token or access key in source code, a public file, or a screenshot.

## Current limitation

AutoEverything 2.0.3 is a Chrome Manifest V3 extension. Its Flow path calls `chrome.scripting.executeScript`, `chrome.debugger.attach/sendCommand`, and `chrome.downloads`. Cloudflare Browser Run exposes a headless browser through CDP/Playwright, not the Chrome extension runtime. Therefore the original extension cannot simply be loaded into this Worker. A separate compatibility port of the Flow queue, trusted CDP input, result tracking, and downloads is still required before hands-free generation can be claimed.
