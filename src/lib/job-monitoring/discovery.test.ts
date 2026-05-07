import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserSnapshotFingerprint,
  discoverJobLinksFromHtml,
  discoverJobLinksWithBrowser,
  isLikelyJobUrl,
} from "./discovery";

test("discoverJobLinksFromHtml resolves relative job links and removes duplicates", () => {
  const html = `
    <main>
      <a href="/careers/frontend-engineer">Frontend Engineer</a>
      <a href="https://example.com/careers/frontend-engineer">Duplicado</a>
      <a href="/privacy">Privacy</a>
    </main>
  `;

  const result = discoverJobLinksFromHtml("https://example.com/jobs", html);

  assert.deepEqual(result, [
    {
      url: "https://example.com/careers/frontend-engineer",
      text: "Frontend Engineer",
    },
  ]);
});

test("discoverJobLinksFromHtml falls back to the page URL when it looks like a single posting", () => {
  const html = `
    <html>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Backend Engineer"}
      </script>
    </html>
  `;

  const result = discoverJobLinksFromHtml("https://example.com/jobs/backend", html);

  assert.deepEqual(result, [
    {
      url: "https://example.com/jobs/backend",
      text: null,
    },
  ]);
});

test("isLikelyJobUrl ignores linkedin and non-job navigation links", () => {
  assert.equal(
    isLikelyJobUrl(
      "https://example.com/careers",
      "https://www.linkedin.com/jobs/view/123",
    ),
    false,
  );
  assert.equal(
    isLikelyJobUrl("https://example.com/careers", "https://example.com/privacy"),
    false,
  );
});

test("isLikelyJobUrl rejects generic cross-origin careers landing pages", () => {
  assert.equal(
    isLikelyJobUrl(
      "https://brmonks.gupy.io/",
      "https://monks.com/careers",
      "Veja todas as vagas",
    ),
    false,
  );
  assert.equal(
    isLikelyJobUrl(
      "https://brmonks.gupy.io/",
      "https://boards.greenhouse.io/acme/jobs/12345",
      "Senior Backend Engineer",
    ),
    true,
  );
});

test("discoverJobLinksWithBrowser iterates through paginated snapshots and deduplicates URLs", async () => {
  const snapshots = [
    {
      activePaginationLabel: "1",
      hasNextPage: true,
      links: [
        {
          url: "https://example.com/careers/frontend-engineer",
          text: "Frontend Engineer",
        },
      ],
    },
    {
      activePaginationLabel: "2",
      hasNextPage: false,
      links: [
        {
          url: "https://example.com/careers/frontend-engineer",
          text: "Frontend Engineer",
        },
        {
          url: "https://example.com/careers/platform-engineer",
          text: "Platform Engineer",
        },
      ],
    },
  ];
  let index = 0;
  let nextCalls = 0;
  let dismissed = false;
  let expanded = false;
  let closed = false;

  const result = await discoverJobLinksWithBrowser(
    {
      id: 1,
      name: "Acme",
      jobsBoardUrl: "https://example.com/careers",
      jobBoardNavigationMode: "browser",
    },
    {
      browserSessionFactory: async () => ({
        dismissCookieBanner: async () => {
          dismissed = true;
        },
        expandItemsPerPage: async () => {
          expanded = true;
        },
        captureSnapshot: async () => snapshots[Math.min(index++, snapshots.length - 1)]!,
        goToNextPage: async () => {
          nextCalls += 1;
          return nextCalls === 1;
        },
        close: async () => {
          closed = true;
        },
      }),
    },
  );

  assert.equal(dismissed, true);
  assert.equal(expanded, true);
  assert.equal(nextCalls, 1);
  assert.equal(closed, true);
  assert.deepEqual(result, [
    {
      url: "https://example.com/careers/frontend-engineer",
      text: "Frontend Engineer",
    },
    {
      url: "https://example.com/careers/platform-engineer",
      text: "Platform Engineer",
    },
  ]);
});

test("buildBrowserSnapshotFingerprint changes with active page label", () => {
  assert.notEqual(
    buildBrowserSnapshotFingerprint({
      activePaginationLabel: "1",
      hasNextPage: true,
      links: [{ url: "https://example.com/jobs/1", text: "Job 1" }],
    }),
    buildBrowserSnapshotFingerprint({
      activePaginationLabel: "2",
      hasNextPage: true,
      links: [{ url: "https://example.com/jobs/1", text: "Job 1" }],
    }),
  );
});
