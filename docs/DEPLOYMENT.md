# Deployment and rollback runbook

## Hosting

- GitHub repository: `bdjben/bdjben.github.io`
- Production branch: `main`
- Publish source: repository root
- Custom domain: `benbadejo.com`
- Custom-domain declaration: root `CNAME`
- Deployment platform: GitHub Pages

The domain is already attached to this repository. A normal website release requires no DNS changes.

## Release procedure

1. Run `npm test`.
2. Run `git diff --check` and review the staged diff.
3. Serve the repository locally and inspect the homepage, booking page, dashboard index, and all four interactive dashboards at desktop and mobile widths.
4. Commit the release on `main` and push to `origin/main`.
5. Confirm the GitHub Pages deployment completes successfully.
6. Verify the production HTML, CSS, JavaScript, images, metadata, and retained demo routes over HTTPS.
7. Add an annotated release tag after production verification.

## Standard rollback

Never force-push `main`. Revert the release commit so the production history remains inspectable:

```bash
git switch main
git pull --ff-only
git revert <release-commit>
git push origin main
```

## Full v2 migration rollback

The pre-migration production state is available in three independent forms:

- Remote tag: `pre-aicessability-redesign-2026-07-14`
- Remote branch: `backup/pre-aicessability-redesign-2026-07-14`
- Local full archive and Git bundle listed in `docs/MIGRATION-2026-07-14.md`

To restore the former site while preserving history:

```bash
git switch main
git pull --ff-only
git revert <v2-release-commit>
git push origin main
```

If the release comprises more than one commit, revert the release range in reverse order. The backup tag is a reference point for comparison and recovery; do not reset or force-push production to it.

## Route guarantees

The release smoke tests protect these retained interactive routes:

- `/openclaw/agenda/`
- `/openclaw/crm/`
- `/openclaw/project-view/`
- `/openclaw/system-monitor/`

They must remain available even when the public-facing dashboard index changes.
