import assert from "node:assert/strict";
import test from "node:test";

import {
  callOllamaLlm,
  getOllamaConfig,
  parseExtractedProfileResponse,
  unloadOllamaModelIfLocal,
} from "@/lib/ai/ollama";

test("normaliza datas opcionais validas sem falhar a extração", () => {
  const parsed = parseExtractedProfileResponse(
    JSON.stringify({
      profile: {
        fullName: "Gabriel Fachini",
        email: "gabriel@example.com",
        phone: null,
        linkedin: null,
        github: null,
        location: null,
        workModelPreference: "remote",
        notes: null,
        masterResumePath: null,
      },
      experiences: [
        {
          company: "Cubbo Logistics",
          role: "Engenheiro de Software Global",
          startDate: "06/2025",
          endDate: "09/2025",
          isCurrent: false,
          description: null,
          bullets: [],
        },
      ],
      skills: [],
      projects: [],
      education: [
        {
          institution: "Universidade de Sao Paulo",
          degree: "Bacharelado",
          field: "Sistemas de Informacao",
          startDate: "N/A",
          endDate: "N/A",
        },
      ],
    }),
  );

  assert.equal(parsed.experiences[0]?.startDate, "2025-06");
  assert.equal(parsed.experiences[0]?.endDate, "2025-09");
  assert.equal(parsed.education[0]?.startDate, null);
  assert.equal(parsed.education[0]?.endDate, null);
});

test("aceita datas correntes opcionais como null", () => {
  const parsed = parseExtractedProfileResponse(
    JSON.stringify({
      profile: {
        fullName: "Gabriel Fachini",
        email: null,
        phone: null,
        linkedin: null,
        github: null,
        location: null,
        workModelPreference: null,
        notes: null,
        masterResumePath: null,
      },
      experiences: [
        {
          company: "Atual Empresa",
          role: "Staff Engineer",
          startDate: "2024-01",
          endDate: "Atual",
          isCurrent: true,
          description: null,
          bullets: [],
        },
      ],
      skills: [],
      projects: [],
      education: [],
    }),
  );

  assert.equal(parsed.experiences[0]?.endDate, null);
  assert.equal(parsed.experiences[0]?.isCurrent, true);
});

test("getOllamaConfig exige modo explicito e api key em cloud", () => {
  const originalEnv = { ...process.env };

  process.env.OLLAMA_RUNTIME_MODE = "cloud";
  process.env.OLLAMA_BASE_URL = "https://ollama.com";
  process.env.OLLAMA_MODEL = "qwen3:latest";
  delete process.env.OLLAMA_API_KEY;

  assert.throws(
    () => getOllamaConfig(),
    /Missing OLLAMA_API_KEY configuration for Ollama Cloud/,
  );

  process.env = originalEnv;
});

test("callOllamaLlm envia Authorization bearer em cloud", async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  process.env.OLLAMA_RUNTIME_MODE = "cloud";
  process.env.OLLAMA_BASE_URL = "https://ollama.com";
  process.env.OLLAMA_MODEL = "qwen3:latest";
  process.env.OLLAMA_API_KEY = "test-key";

  let capturedAuthorization = "";

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    capturedAuthorization = headers.get("Authorization") ?? "";

    return new Response(
      JSON.stringify({
        response: "{}",
        done_reason: "stop",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }) as typeof fetch;

  try {
    const response = await callOllamaLlm("ola");
    assert.equal(response, "{}");
    assert.equal(capturedAuthorization, "Bearer test-key");
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});

test("unloadOllamaModelIfLocal nao chama fetch em cloud", async () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  process.env.OLLAMA_RUNTIME_MODE = "cloud";
  process.env.OLLAMA_BASE_URL = "https://ollama.com";
  process.env.OLLAMA_MODEL = "qwen3:latest";
  process.env.OLLAMA_API_KEY = "test-key";

  let called = false;

  global.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;

  try {
    await unloadOllamaModelIfLocal();
    assert.equal(called, false);
  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }
});
