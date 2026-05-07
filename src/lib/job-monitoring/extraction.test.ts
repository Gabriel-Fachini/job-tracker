import test from "node:test";
import assert from "node:assert/strict";

import { extractJobDetailFromHtml } from "./extraction";

test("extractJobDetailFromHtml prefers JobPosting JSON-LD when present", () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Backend Engineer",
            "description": "Atue com Node.js e sistemas distribuidos.",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Sao Paulo",
                "addressRegion": "SP",
                "addressCountry": "BR"
              }
            }
          }
        </script>
      </head>
      <body />
    </html>
  `;

  const result = extractJobDetailFromHtml("https://example.com/jobs/backend", html);

  assert.equal(result?.title, "Senior Backend Engineer");
  assert.equal(result?.locationText, "Sao Paulo, SP, BR");
  assert.equal(result?.workModel, null);
  assert.equal(result?.seniority, "senior");
});

test("extractJobDetailFromHtml falls back to semantic HTML content", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Product Engineer" />
      </head>
      <body>
        <main>
          <h1>Product Engineer</h1>
          <p>Vaga remota para atuar com TypeScript, React e produto.</p>
          <p>Trabalho remoto e contato frequente com stakeholders.</p>
        </main>
      </body>
    </html>
  `;

  const result = extractJobDetailFromHtml("https://example.com/careers/product", html);

  assert.equal(result?.title, "Product Engineer");
  assert.match(result?.description ?? "", /TypeScript/);
  assert.equal(result?.workModel, "remote");
});

test("extractJobDetailFromHtml decodes html-encoded job posting payloads", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="[Monks] Performance Media Analyst" />
        <script type="application/ld+json">
          {&quot;@context&quot;:&quot;https://schema.org&quot;,&quot;@type&quot;:&quot;JobPosting&quot;,&quot;title&quot;:&quot;[Monks] Performance Media Analyst&quot;,&quot;description&quot;:&quot;&lt;h2&gt;Descrição da vaga&lt;/h2&gt;&lt;p&gt;If you have a data-driven profile and know paid media, this opportunity could be yours.&lt;/p&gt;&quot;}
        </script>
      </head>
      <body>
        <main>
          <style>.css-6an89h{display:block;}</style>
          <h1>[Monks] Performance Media Analyst</h1>
        </main>
      </body>
    </html>
  `;

  const result = extractJobDetailFromHtml(
    "https://brmonks.gupy.io/jobs/10783444?jobBoardSource=gupy_public_page",
    html,
  );

  assert.equal(result?.title, "[Monks] Performance Media Analyst");
  assert.equal(result?.seniority, null);
  assert.equal(result?.workModel, null);
  assert.match(result?.description ?? "", /data-driven profile/);
  assert.doesNotMatch(result?.description ?? "", /\.css-6an89h/);
});
