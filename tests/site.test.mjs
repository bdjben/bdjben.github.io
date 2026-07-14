import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

const index = await read("index.html");
const booking = await read("book", "index.html");
const dashboards = await read("dashboards", "index.html");
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

test("former review brand is absent from visitor-facing surfaces", () => {
  for (const surface of [index, booking, dashboards, notFound, manifest]) {
    assert.doesNotMatch(surface, /AIcessability/i);
  }

  assert.match(index, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
  assert.match(booking, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
  assert.match(dashboards, /aria-label="Ben Badejo home">Ben Badejo<\/a>/);
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
