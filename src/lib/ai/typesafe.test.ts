import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_TYPESAFE_MODEL,
  evaluateSystemOne,
  getTypeSafeConfig,
  parseRetryAfterMs,
  TYPESAFE_ENDPOINT,
  TypeSafeConfigurationError,
  TypeSafeRequestError,
  type TypeSafeConfig,
  type TypeSafeQuestion,
} from "./typesafe";

const config: TypeSafeConfig = {
  apiKey: "test-key-not-real",
  model: "jev-1.13.0",
  endpoint: TYPESAFE_ENDPOINT,
  timeoutMs: 1000,
};

const questions: Record<string, TypeSafeQuestion> = {
  is_urgent: { type: "noul", instructions: "Is it urgent?" },
  department: {
    type: "choice",
    instructions: "Which team?",
    criteria: { billing: "Payments", technical: null },
  },
};

const okBody = {
  model: "jev-1.13.0",
  answers: {
    is_urgent: { type: "noul", noul: 0.95 },
    department: {
      type: "choice",
      choice: "billing",
      probabilities: { billing: 0.88, technical: 0.12 },
      confidence: 0.81,
    },
  },
  usage: { input_tokens: 296, output_tokens: 20 },
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("TYPESAFE_BASE_URL points the client at any compatible server; the key is optional off the official host", async () => {
  const local = getTypeSafeConfig({ TYPESAFE_BASE_URL: "http://127.0.0.1:8000/" });

  assert.equal(local.endpoint, "http://127.0.0.1:8000/v1/systemone");
  assert.equal(local.apiKey, null);
  assert.equal(getTypeSafeConfig({ TYPESAFE_BASE_URL: "https://laya.example/api" }).endpoint, "https://laya.example/api/v1/systemone");

  // No key: no Authorization header at all.
  const headersSeen: Array<Record<string, string>> = [];
  await evaluateSystemOne({
    state: "x",
    questions,
    config: local,
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      headersSeen.push(init?.headers as Record<string, string>);
      return json({ ...okBody, model: "laya-checkpoint-7" });
    }) as typeof fetch,
    onUsage: (info) => assert.equal(info.model, "laya-checkpoint-7"),
  });
  assert.equal(headersSeen[0].authorization, undefined);

  // With a key on a non-official host, the Bearer header is sent.
  const keyed = getTypeSafeConfig({ TYPESAFE_BASE_URL: "http://127.0.0.1:8000", TYPESAFE_API_KEY: "local-key" });
  assert.equal(keyed.apiKey, "local-key");

  // The official host stays fail-closed, spelled explicitly or by default.
  assert.throws(() => getTypeSafeConfig({ TYPESAFE_BASE_URL: "https://api.typesafe.ai" }), TypeSafeConfigurationError);
  assert.equal(getTypeSafeConfig({ TYPESAFE_BASE_URL: "https://api.typesafe.ai/", TYPESAFE_API_KEY: "k" }).endpoint, TYPESAFE_ENDPOINT);

  assert.throws(() => getTypeSafeConfig({ TYPESAFE_BASE_URL: "not a url" }), /inválida/);
  assert.throws(() => getTypeSafeConfig({ TYPESAFE_BASE_URL: "ftp://x.example" }), /http\(s\)/);
});

test("getTypeSafeConfig fails closed without a key and pins the model version by default", () => {
  assert.throws(() => getTypeSafeConfig({}), TypeSafeConfigurationError);
  assert.throws(() => getTypeSafeConfig({ TYPESAFE_API_KEY: "  " }), /TYPESAFE_API_KEY/);

  const resolved = getTypeSafeConfig({ TYPESAFE_API_KEY: "k" });
  assert.equal(resolved.model, DEFAULT_TYPESAFE_MODEL);
  assert.equal(DEFAULT_TYPESAFE_MODEL, "jev-1.13.0");
  assert.equal(resolved.endpoint, "https://api.typesafe.ai/v1/systemone");

  const custom = getTypeSafeConfig({ TYPESAFE_API_KEY: "k", TYPESAFE_MODEL: "jev-1.14.0", TYPESAFE_TIMEOUT_MS: "5000" });
  assert.equal(custom.model, "jev-1.14.0");
  assert.equal(custom.timeoutMs, 5000);
});

test("evaluateSystemOne posts state, model and all questions in one authenticated call", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const usages: unknown[] = [];

  const result = await evaluateSystemOne({
    state: { title: "Backend Engineer" },
    questions,
    config,
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      return json(okBody);
    }) as typeof fetch,
    onUsage: (info) => usages.push(info),
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, TYPESAFE_ENDPOINT);
  assert.equal(requests[0].init.method, "POST");

  const headers = requests[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer test-key-not-real");
  assert.equal(headers["content-type"], "application/json");

  assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
    state: { title: "Backend Engineer" },
    model: "jev-1.13.0",
    questions,
  });

  assert.equal(result.model, "jev-1.13.0");
  assert.deepEqual(result.usage, { input_tokens: 296, output_tokens: 20 });
  assert.equal(result.answers.is_urgent.type, "noul");
  assert.deepEqual(usages, [{ model: "jev-1.13.0", usage: { input_tokens: 296, output_tokens: 20 }, attempts: 1 }]);
});

test("evaluateSystemOne retries 429 honoring retry-after and gives up after 3 retries", async () => {
  const waits: number[] = [];
  let calls = 0;

  const result = await evaluateSystemOne({
    state: "x",
    questions,
    config,
    sleep: async (ms) => {
      waits.push(ms);
    },
    fetchImpl: (async () => {
      calls += 1;
      return calls < 3 ? json({}, 429, { "retry-after": "2" }) : json(okBody);
    }) as typeof fetch,
  });

  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 2000]);
  assert.equal(result.usage.input_tokens, 296);

  calls = 0;
  const gaveUp: number[] = [];

  await assert.rejects(
    evaluateSystemOne({
      state: "x",
      questions,
      config,
      sleep: async (ms) => {
        gaveUp.push(ms);
      },
      fetchImpl: (async () => {
        calls += 1;
        return json({ error: "slow down" }, 429);
      }) as typeof fetch,
    }),
    (error: unknown) => error instanceof TypeSafeRequestError && error.status === 429,
  );

  // 1 attempt + 3 retries, exponential backoff when the header is absent.
  assert.equal(calls, 4);
  assert.deepEqual(gaveUp, [1000, 2000, 4000]);
});

test("evaluateSystemOne retries 529 (overloaded) but not 401 or 422", async () => {
  let calls = 0;
  const ok = await evaluateSystemOne({
    state: "x",
    questions,
    config,
    sleep: async () => undefined,
    fetchImpl: (async () => {
      calls += 1;
      return calls === 1 ? json({}, 529) : json(okBody);
    }) as typeof fetch,
  });
  assert.equal(calls, 2);
  assert.ok(ok.answers.department);

  for (const status of [401, 422]) {
    let attempts = 0;

    await assert.rejects(
      evaluateSystemOne({
        state: "x",
        questions,
        config,
        sleep: async () => undefined,
        fetchImpl: (async () => {
          attempts += 1;
          return json({ detail: "bad request body" }, status);
        }) as typeof fetch,
      }),
      (error: unknown) => error instanceof TypeSafeRequestError && error.status === status && /bad request body/.test(error.message),
    );
    assert.equal(attempts, 1);
  }
});

test("evaluateSystemOne wraps network failures and malformed bodies", async () => {
  await assert.rejects(
    evaluateSystemOne({
      state: "x",
      questions,
      config,
      fetchImpl: (async () => {
        throw new Error("ECONNRESET");
      }) as typeof fetch,
    }),
    /Falha de rede.*ECONNRESET/,
  );

  await assert.rejects(
    evaluateSystemOne({ state: "x", questions, config, fetchImpl: (async () => json({ nope: true })) as typeof fetch }),
    /sem `answers`/,
  );
});

test("parseRetryAfterMs reads seconds and HTTP dates and caps absurd values", () => {
  assert.equal(parseRetryAfterMs(null), null);
  assert.equal(parseRetryAfterMs("3"), 3000);
  assert.equal(parseRetryAfterMs("9999"), 30_000);
  assert.equal(parseRetryAfterMs("garbage"), null);

  const now = Date.parse("2026-09-28T12:00:00Z");
  assert.equal(parseRetryAfterMs("Mon, 28 Sep 2026 12:00:05 GMT", now), 5000);
});
