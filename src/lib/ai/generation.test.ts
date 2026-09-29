import assert from "node:assert/strict";
import test from "node:test";

import {
  formatJobDescription,
  generateText,
  getGenerationEngine,
  GenerationConfigurationError,
} from "./generation";
import {
  callOpenAiStructured,
  DEFAULT_OPENAI_GENERATION_MODEL,
  DEFAULT_OPENAI_TRIAGE_MODEL,
  getOpenAiGenerationModel,
  getOpenAiTriageModel,
  requireOpenAiApiKey,
  type OpenAiResponsesClient,
} from "./openai-runtime";

function fakeClient(
  reply: { output_text?: string | null; incomplete_details?: { reason?: string } | null } = { output_text: "ok" },
) {
  const calls: Array<Record<string, unknown>> = [];
  const client: OpenAiResponsesClient = {
    responses: {
      create: async (params) => {
        calls.push(params);
        return { ...reply, usage: { input_tokens: 10, output_tokens: 5 } };
      },
    },
  };

  return { client, calls };
}

test("GENERATION_ENGINE defaults to openai and rejects unknown values", () => {
  assert.equal(getGenerationEngine({}), "openai");
  assert.equal(getGenerationEngine({ GENERATION_ENGINE: "OpenAI" }), "openai");
  assert.equal(getGenerationEngine({ GENERATION_ENGINE: "ollama" }), "ollama");
  assert.throws(() => getGenerationEngine({ GENERATION_ENGINE: "claude" }), GenerationConfigurationError);
});

test("model env vars have the documented defaults", () => {
  assert.equal(DEFAULT_OPENAI_TRIAGE_MODEL, "gpt-5.4-nano");
  assert.equal(DEFAULT_OPENAI_GENERATION_MODEL, "gpt-5.4-mini");
  assert.equal(getOpenAiTriageModel({}), "gpt-5.4-nano");
  assert.equal(getOpenAiGenerationModel({}), "gpt-5.4-mini");
  assert.equal(getOpenAiTriageModel({ OPENAI_TRIAGE_MODEL: "custom-triage" }), "custom-triage");
  assert.equal(getOpenAiGenerationModel({ OPENAI_GENERATION_MODEL: " custom-gen " }), "custom-gen");
});

test("requireOpenAiApiKey fails closed with a clear message", () => {
  assert.throws(() => requireOpenAiApiKey({}), /OPENAI_API_KEY/);
  assert.equal(requireOpenAiApiKey({ OPENAI_API_KEY: " k " }), "k");
});

test("generateText with the openai engine sends system + user to the generation model", async () => {
  const { client, calls } = fakeClient({ output_text: "  Hello cover letter  " });

  const text = await generateText({
    engine: "openai",
    system: "You write cover letters.",
    prompt: "Write one.",
    client,
    maxOutputTokens: 500,
  });

  assert.equal(text, "Hello cover letter");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, getOpenAiGenerationModel());
  assert.equal(calls[0].max_output_tokens, 500);
  assert.deepEqual(calls[0].input, [
    { role: "system", content: "You write cover letters." },
    { role: "user", content: "Write one." },
  ]);
  assert.equal(calls[0].text, undefined);
});

test("generateText with json asks for a JSON object", async () => {
  const { client, calls } = fakeClient({ output_text: '{"a":1}' });

  await generateText({ engine: "openai", system: "s", prompt: "p", json: true, client });

  assert.deepEqual(calls[0].text, { format: { type: "json_object" } });
});

test("OpenAI failures and incomplete answers become descriptive errors", async () => {
  await assert.rejects(
    generateText({
      engine: "openai",
      system: "s",
      prompt: "p",
      client: { responses: { create: async () => { throw new Error("rate limited"); } } },
    }),
    /Falha na chamada à OpenAI.*rate limited/,
  );

  await assert.rejects(
    generateText({ engine: "openai", system: "s", prompt: "p", client: fakeClient({ output_text: "x", incomplete_details: { reason: "max_output_tokens" } }).client }),
    /interrompeu.*max_output_tokens/,
  );

  await assert.rejects(
    generateText({ engine: "openai", system: "s", prompt: "p", client: fakeClient({ output_text: "  " }).client }),
    /não devolveu texto/,
  );
});

test("callOpenAiStructured sends a strict json_schema", async () => {
  const { client, calls } = fakeClient({ output_text: '{"x":"a"}' });
  const schema = { type: "object", additionalProperties: false, required: ["x"], properties: { x: { type: "string" } } };

  const result = await callOpenAiStructured({
    model: "gpt-5.4-nano",
    system: "s",
    user: "u",
    schemaName: "demo",
    schema,
    client,
  });

  assert.equal(result.outputText, '{"x":"a"}');
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5 });
  assert.deepEqual(calls[0].text, {
    format: { type: "json_schema", name: "demo", schema, strict: true },
  });
});

test("formatJobDescription uses the generation engine and rejects empty text", async () => {
  const { client, calls } = fakeClient({ output_text: "## Requisitos\n- **TypeScript**" });

  const formatted = await formatJobDescription("Precisamos de TypeScript", { engine: "openai", client });

  assert.match(formatted, /## Requisitos/);
  assert.match(String((calls[0].input as Array<{ content: string }>)[0].content), /markdown/);

  await assert.rejects(formatJobDescription("   ", { engine: "openai", client }), /vazia/);
});
