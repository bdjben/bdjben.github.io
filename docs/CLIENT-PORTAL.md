# Client Portal operating note

## Current implementation

`/client-portal/` is a dependency-free static document page hosted with the rest of the site on GitHub Pages. It asks for a Client Key, hashes the entered value in the browser with SHA-256, and compares that hash with the configured value in `client-portal/portal.js`.

Successful access lasts for the current browser tab session through `sessionStorage`. Signing out clears that state. The route is marked `noindex, nofollow, noarchive` and is intentionally excluded from `sitemap.xml`.

The downloadable files live in `client-portal/files/`. Their public URLs are therefore accessible to anyone who already knows or discovers the exact URL. The key prompt is an organizational convenience for non-sensitive, shareable materials; it is not an authorization boundary.

## Updating the portal

1. Add, replace, or remove files in `client-portal/files/`.
2. Update the document rows in `client-portal/index.html`.
3. If the key changes, replace `expectedKeyHash` in `client-portal/portal.js` with the SHA-256 digest of the new key. Do not put the plaintext key in visitor-facing source.
4. Update `tests/site.test.mjs` to match the current file inventory and expected digest.
5. Run `npm test`, review the login and download views at desktop and mobile widths, and verify each download before publishing.

## Future secure implementation

True private client access requires a server-side authorization layer rather than static GitHub Pages. A production authenticated portal should include:

- individual, revocable client identities or magic links;
- server-validated sessions with expiration;
- files stored outside the public website repository;
- per-client authorization checks on every download;
- access logging and administrative revocation;
- rate limiting and credential-rotation procedures.

The current route and visual interface can remain the frontend entry point when that backend is introduced.
