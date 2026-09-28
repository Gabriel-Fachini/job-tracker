import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { GET as getTargets } from "@/app/api/glassdoor/targets/route";
import { POST as postImport } from "@/app/api/glassdoor/import/route";

assert.match(
  process.env.DATABASE_URL ?? "",
  /test\.db$/,
  "glassdoor tests need DATABASE_URL=./tmp/test.db (use `npm test`)",
);

const original = process.env.GLASSDOOR_IMPORT_TOKEN;

beforeEach(() => {
  delete process.env.GLASSDOOR_IMPORT_TOKEN;
});

afterEach(() => {
  if (original === undefined) {
    delete process.env.GLASSDOOR_IMPORT_TOKEN;
  } else {
    process.env.GLASSDOOR_IMPORT_TOKEN = original;
  }
});

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, init);
}

test("endpoints fail closed with 503 when the token is not configured", async () => {
  const targets = await getTargets(request("/api/glassdoor/targets", {
    headers: { authorization: "Bearer anything" },
  }));
  const imported = await postImport(request("/api/glassdoor/import", { method: "POST", body: "{}" }));

  assert.equal(targets.status, 503);
  assert.equal(imported.status, 503);
});

test("an empty token counts as not configured", async () => {
  process.env.GLASSDOOR_IMPORT_TOKEN = "";

  const response = await getTargets(request("/api/glassdoor/targets", {
    headers: { authorization: "Bearer " },
  }));

  assert.equal(response.status, 503);
});

test("a wrong or missing token gets 401", async () => {
  process.env.GLASSDOOR_IMPORT_TOKEN = "correct-horse";

  const wrong = await getTargets(request("/api/glassdoor/targets", {
    headers: { authorization: "Bearer nope" },
  }));
  const missing = await postImport(request("/api/glassdoor/import", { method: "POST", body: "{}" }));

  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
});

test("the right token gets through; bad bodies are rejected with 4xx", async () => {
  process.env.GLASSDOOR_IMPORT_TOKEN = "correct-horse";
  const headers = { authorization: "Bearer correct-horse" };

  const targets = await getTargets(request("/api/glassdoor/targets?glassdoorId=42&name=Nova", { headers }));
  const body = (await targets.json()) as { ok: boolean; targets: Array<{ companyId: number | null }> };
  assert.equal(targets.status, 200);
  assert.equal(body.targets[0].companyId, null);

  const badId = await getTargets(request("/api/glassdoor/targets?glassdoorId=abc", { headers }));
  assert.equal(badId.status, 400);

  const notJson = await postImport(request("/api/glassdoor/import", { method: "POST", headers, body: "not json" }));
  assert.equal(notJson.status, 400);

  const wrongVersion = await postImport(request("/api/glassdoor/import", {
    method: "POST",
    headers,
    body: JSON.stringify({ schema_version: 9 }),
  }));
  assert.equal(wrongVersion.status, 422);
});
