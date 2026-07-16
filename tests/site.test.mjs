import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

const index = await read("index.html");
const booking = await read("book", "index.html");
const dashboards = await read("dashboards", "index.html");
const clientPortal = await read("client-portal", "index.html");
const portalScript = await read("client-portal", "portal.js");
const notFound = await read("404.html");
const manifest = await read("site.webmanifest");
const styles = await read("styles.css");

test("production metadata is present", () => {
  assert.match(index, /<title>Ben Badejo \| Applied AI Systems for Business Operations<\/title>/);
  assert.match(index, /<meta name="robots" content="index, follow">/);
  assert.match(index, /<link rel="canonical" href="https:\/\/benbadejo\.com\/">/);
  assert.match(index, /<meta property="og:image" content="https:\/\/benbadejo\.com\/og-image\.jpg">/);
  assert.doesNotMatch(index, /not live|concept direction|noindex, nofollow/i);
});

test("custom-domain files are correct", async () => {
  const cname = await read("CNAME");
  const robots = await read("robots.txt");
  const sitemap = await read("sitemap.xml");

  assert.equal(cname.trim(), "benbadejo.com");
  assert.match(robots, /Sitemap: https:\/\/benbadejo\.com\/sitemap\.xml/);
  for (const route of ["", "book/", "dashboards/"]) {
    assert.match(sitemap, new RegExp(`<loc>https://benbadejo\\.com/${route}</loc>`));
  }

  assert.doesNotMatch(sitemap, /client-portal/);
});

test("homepage local HTML and CSS assets exist", async () => {
  const htmlRefs = [...index.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
  const cssRefs = [...styles.matchAll(/url\("\.\/([^"?#]+)"\)/g)].map((match) => match[1]);
  const refs = [...new Set([...htmlRefs, ...cssRefs])].filter((ref) => !ref.endsWith("/"));

  assert.ok(refs.length > 10, "expected the production page to reference its local assets");
  await Promise.all(refs.map((ref) => access(path.join(root, ref))));
});

test("core navigation and dashboard discovery targets exist", () => {
  for (const id of ["capabilities", "engagements", "work", "trust", "company"]) {
    assert.match(index, new RegExp(`id="${id}"`));
    assert.match(index, new RegExp(`href="#${id}"`));
  }

  assert.match(index, /href="\.\/dashboards\/">Dashboards<\/a>/);
  assert.match(index, /Explore four interactive dashboards/);
});

test("Client Portal precedes Book a call across primary page headers", () => {
  const surfaces = [index, booking, dashboards, clientPortal];

  for (const surface of surfaces) {
    const header = surface.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] ?? "";
    const portalPosition = header.indexOf(">Client Portal</a>");
    const bookingPosition = header.indexOf(">Book a call</a>");

    assert.ok(portalPosition >= 0, "expected a Client Portal header action");
    assert.ok(bookingPosition >= 0, "expected a Book a call header action");
    assert.ok(portalPosition < bookingPosition, "expected Client Portal before Book a call");
    assert.match(header, /class="mobile-portal-link"/);
  }
});

test("Client Portal key gate and document downloads are configured", async () => {
  const portalKey = ["2026", "0716"].join("");
  const expectedHash = createHash("sha256").update(portalKey).digest("hex");
  const downloads = [
    "Sign-in-with-ChatGPT-Technical-Overview.docx",
    "Sign-in-with-ChatGPT-Technical-Overview.pdf",
    "chatgpt-oauth-transport-test-1.0.0.tgz.zip",
  ];

  assert.match(clientPortal, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(clientPortal, /<h2 id="portal-documents-heading"[^>]*>Available Files and Documents<\/h2>/);
  assert.match(clientPortal, /<label for="client-key">Client Key<\/label>/);
  assert.match(portalScript, new RegExp(expectedHash));
  assert.doesNotMatch(portalScript, new RegExp(portalKey));

  for (const filename of downloads) {
    assert.match(clientPortal, new RegExp(`href="\\.\\/files/${filename.replaceAll(".", "\\.")}" download`));
    await access(path.join(root, "client-portal", "files", filename));
  }
});

test("former review brand is absent from visitor-facing surfaces", () => {
  for (const surface of [index, booking, dashboards, clientPortal, notFound, manifest]) {
    assert.doesNotMatch(surface, /AIcessability/i);
  }

  assert.match(index, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
  assert.match(booking, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
  assert.match(dashboards, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
  assert.match(clientPortal, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
});

test("booking page routes each session directly to its date picker", () => {
  const appointmentTypes = [
    "jsid3277851",
    "jsid982392",
    "jsid6259313",
    "jsid4735414",
    "jsid3830076",
    "jsid2634290",
  ];

  for (const appointmentType of appointmentTypes) {
    assert.match(
      booking,
      new RegExp(`https://benbadejo\\.youcanbook\\.me/selectTime\\?appointmentTypeIds=${appointmentType}`),
    );
  }

  assert.match(booking, /<link rel="canonical" href="https:\/\/benbadejo\.com\/book\/">/);
  assert.match(booking, /id="larger-engagement"/);
});

test("booking and dashboard page local assets exist", async () => {
  for (const surface of [booking, dashboards]) {
    const refs = [...surface.matchAll(/(?:href|src)="\.\.\/([^"#?]+)"/g)]
      .map((match) => match[1])
      .filter((ref) => !ref.endsWith("/") && !ref.startsWith("#"));

    await Promise.all([...new Set(refs)].map((ref) => access(path.join(root, ref))));
  }
});

test("all four interactive dashboards are showcased and retained", async () => {
  const suite = [
    ["agenda", "home-dashboard-agenda.png", "Agenda"],
    ["crm", "home-dashboard-crm.png", "CRM"],
    ["project-view", "home-dashboard-project-view.png", "Project View"],
    ["system-monitor", "home-dashboard-system-monitor.png", "System Monitor"],
  ];

  for (const [route, image, title] of suite) {
    assert.match(dashboards, new RegExp(`href="\\.\\./openclaw/${route}/"`));
    assert.match(dashboards, new RegExp(`src="\\.\\./assets/screenshots/${image}"`));
    assert.match(dashboards, new RegExp(`>${title}<`));
    await access(path.join(root, "openclaw", route, "index.html"));
    await access(path.join(root, "assets", "screenshots", image));
  }
});

test("BB favicon and booking concepts are preserved", async () => {
  const favicon = await read("favicon.svg");
  assert.match(favicon, /aria-label="BB monogram"/);
  assert.equal((favicon.match(/>B<\/text>/g) || []).length, 2);
  await access(path.join(root, "favicon.ico"));
  await access(path.join(root, "docs", "mockups", "booking-desktop-concept.png"));
  await access(path.join(root, "docs", "mockups", "booking-mobile-concept.png"));
});

test("retired investor calls to action stay removed", () => {
  assert.doesNotMatch(index, /Request the investor brief|Meet Ben Badejo, founder|The delivery model is productized/i);
});

test("company section uses the approved heading", () => {
  assert.match(index, /<h2>Our Vision<\/h2>/);
  assert.doesNotMatch(index, /Custom systems today\. A repeatable implementation company tomorrow\./);
});
