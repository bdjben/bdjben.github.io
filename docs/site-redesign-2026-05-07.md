# Site redesign deployment record - 2026-05-07

## Purpose

Redesign `benbadejo.com` as a modern, professional, businesslike static site for custom AI systems work.

The live stack remains GitHub Pages from `bdjben/bdjben.github.io`. No migration to Supabase, Render, or another host was needed because the site is static and GitHub Pages is the simplest deployment surface for this repo.

## Positioning

The copy now emphasizes:

- Personalized AI automations
- Operational dashboards
- Observable and extensible workflows
- Codex / OpenClaw / Hermes systems
- Real, customized systems rather than generic demos
- Privacy- and security-sensitive deployment options, including local-model-only operation when the client has sufficiently capable hardware for the required open-source models

## Major changes

- Rebuilt the homepage around a large editorial hero, larger contact block, and clearer service pathways.
- Rebuilt `/openclaw/` as a systems hub for dashboards and projects built with Codex / OpenClaw / Hermes.
- Added a dedicated `/booking/` page that presents YouCanBookMe options in the site design instead of sending users directly to an unstyled scheduler.
- Added project screenshots for LanguageCommand.com and the self-hosted research library.
- Added image carousel behavior for the LanguageCommand and Local Library project cards.
- Added a Matrix / Element orchestration section showing how multi-agent, parallel-project workflows can be coordinated through private self-hosted chat rooms.
- Enlarged small typography across navigation, contact links, section labels, cards, captions, and booking metadata.

## Validation

Commands run locally before deployment:

```bash
npx --yes html-validate index.html openclaw/index.html booking/index.html
```

Rendered smoke testing used local Playwright against:

- `http://127.0.0.1:8050/`
- `http://127.0.0.1:8050/openclaw/`
- `http://127.0.0.1:8050/booking/`
- desktop viewport `1440x1000`
- mobile homepage viewport `390x844`

Checks covered:

- Page title and content load
- No console errors or page errors
- No horizontal overflow in tested viewports
- Requested intro copy present on the homepage
- `Contact` heading present and `Direct contact` removed
- `Codex / OpenClaw / Hermes` language present
- No visible text under 16px in tested pages
- LanguageCommand carousel advances from `1 / 5` to `2 / 5`
- Local Library carousel advances from `1 / 2` to `2 / 2`

## Rollback

Before publishing the redesign, preserve the previous live site at:

- Branch: `backup/pre-redesign-2026-05-07`
- Tag: `pre-redesign-2026-05-07`
- Baseline commit: `3d0ebff` (`Restore CRM dashboard layout`)

Rollback command if needed:

```bash
git fetch origin
git checkout main
git reset --hard pre-redesign-2026-05-07
git push --force-with-lease origin main
```

Only use the rollback command intentionally because it rewrites `main`.
