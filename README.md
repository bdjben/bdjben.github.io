# Ben Badejo applied AI systems website

Production source for [benbadejo.com](https://benbadejo.com/), published from the `main` branch with GitHub Pages.

## Local development

Requirements: Node.js 20+ and Python 3.

```bash
npm test
npm run serve
```

Open `http://127.0.0.1:8060/`.

## Publishing

GitHub Pages publishes the repository root. The root `CNAME` file binds the deployment to `benbadejo.com`.

Every production change should:

1. Pass `npm test` locally.
2. Be reviewed in a local static server at desktop and mobile widths.
3. Be committed with a focused message.
4. Be pushed to `main` only when ready for production.
5. Be checked at `https://benbadejo.com/` after the Pages deployment completes.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment and rollback procedures. See [docs/MIGRATION-2026-07-14.md](docs/MIGRATION-2026-07-14.md) for the v2 migration record.

## Architecture

This is a dependency-free static site:

- `index.html`: primary company website
- `book/index.html`: direct booking menu with appointment-specific YouCanBook.me links
- `client-portal/index.html`: lightweight, noindex document portal with a client-key prompt
- `client-portal/files/`: documents currently offered through the portal
- `dashboards/index.html`: showcase for the four interactive dashboard demos
- `openclaw/`: retained interactive Agenda, CRM, Project View, and System Monitor applications
- `styles.css`: responsive visual system shared by the primary pages
- `script.js`: mobile navigation and current-year behavior
- `assets/`: optimized product screenshots and retained portfolio assets
- `fonts/`: self-hosted Manrope and IBM Plex Mono web fonts
- `tests/`: production smoke tests

Legacy portfolio and VoiceClaw routes remain in place for URL stability. No analytics, cookies, forms, or third-party scripts are loaded by the primary site.

The Client Portal is an interim static access gate, not secure authentication. See [docs/CLIENT-PORTAL.md](docs/CLIENT-PORTAL.md) for its operating model and the requirements for a future authenticated implementation.

## Copyright

Copyright 2026 Ben Badejo. All rights reserved. No license is granted for reuse of the source or visual assets.
