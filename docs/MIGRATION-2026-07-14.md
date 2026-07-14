# Production migration record — 2026-07-14

## Scope

The approved applied AI systems website was migrated from the review deployment to `benbadejo.com`. The primary homepage, booking experience, metadata, favicon, social image, responsive visual system, documentation, and smoke tests were replaced. Existing non-home routes were retained for compatibility.

A new `/dashboards/` page was added to present and link the four existing interactive applications without changing their implementation:

- Agenda: `/openclaw/agenda/`
- CRM: `/openclaw/crm/`
- Project View: `/openclaw/project-view/`
- System Monitor: `/openclaw/system-monitor/`

## Pre-migration production state

- Commit: `892567010ee20debfed010c316641f4fcda93960`
- Remote tag: `pre-aicessability-redesign-2026-07-14`
- Remote branch: `backup/pre-aicessability-redesign-2026-07-14`

## Full local backups

- Repository archive: `/Users/assistant/Documents/Website Backups/benbadejo.com-pre-aicessability-redesign-2026-07-14-050643-IDT.tar.gz`
- Archive SHA-256: `021e19064afe22ba76fc08cb4ad1fa6c38b6c2490853b10878a715ce24a70322`
- Complete Git bundle: `/Users/assistant/Documents/Website Backups/benbadejo.com-pre-aicessability-redesign-2026-07-14-050643-IDT.bundle`
- Bundle SHA-256: `8b2038497d62d69200bb7e5bebd25c8f1571f24e2bcd6b616cdb4cb78a928347`

The compressed archive includes the complete working tree, `.git` directory, and the pre-existing untracked `.DS_Store`. `git bundle verify` confirmed that the bundle contains complete repository history.

## Preserved routes

The migration intentionally leaves these directories in place:

- `openclaw/`
- `voiceclawrealtime/`
- `booking/`
- `side-projects/`

The primary navigation now uses `/book/` and `/dashboards/`; the older routes remain available to avoid breaking saved links.

## Production verification

- Website release commit: `a40f55b5003839e1a4ad43b44ec00ee48894f389`
- GitHub Pages workflow run: `29301342757`
- Workflow result: successful
- GitHub Pages status: built
- Custom domain: `benbadejo.com`
- HTTPS enforcement: enabled
- HTTP behavior: redirects to `https://benbadejo.com/`

The homepage, booking page, dashboard index, four interactive dashboard routes, shared stylesheet, script, favicon, and social image all returned successful production responses after deployment.
