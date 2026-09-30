/**
 * Fills an application form in a browser on YOUR machine from the kit the app prepared.
 *
 *   npm run apply:fill -- --app-url http://localhost:3000 --application 42
 *
 * What it does: opens the form (headed Chromium, persistent profile in tmp/apply-profile so
 * logins you do by hand are remembered), types the mapped answers, attaches the English resume,
 * highlights what it left for you (unknown fields, demographic questions) and STOPS. It never
 * clicks anything, never presses Enter and never submits: you review and send it yourself.
 * If a login wall or a CAPTCHA shows up it stops filling and tells you in the terminal.
 * It runs on your computer because the VPS has no display.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Locator, type Page } from "playwright";

import { detectBlockedPage } from "../src/lib/apply/form-extract";
import { buildFillPlan, summarizePlan, type FillAction, type KitJson } from "../src/lib/apply/fill-plan";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);

  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function loadKit(appUrl: string, applicationId: string): Promise<KitJson> {
  const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/applications/${applicationId}/kit`);

  if (!response.ok) {
    throw new Error(`O app respondeu HTTP ${response.status}. Prepare o kit em /applications/${applicationId}/kit primeiro.`);
  }

  return (await response.json()) as KitJson;
}

async function downloadResume(appUrl: string, kit: KitJson, applicationId: string): Promise<string | null> {
  if (!kit.resumeUrl) {
    return null;
  }

  const response = await fetch(`${appUrl.replace(/\/$/, "")}${kit.resumeUrl}?download=1`);

  if (!response.ok) {
    console.log(`Currículo não baixado (HTTP ${response.status}); anexe à mão.`);
    return null;
  }

  const directory = path.resolve("tmp", "apply");

  mkdirSync(directory, { recursive: true });

  const target = path.join(directory, `resume-${applicationId}.pdf`);

  writeFileSync(target, Buffer.from(await response.arrayBuffer()));

  return target;
}

/** The control for a field: its selector/name first, then its visible label. */
async function locate(page: Page, field: FillAction["field"]): Promise<Locator | null> {
  const candidates: Locator[] = [];

  if (field.selector) candidates.push(page.locator(field.selector));
  if (field.name) candidates.push(page.locator(`[name="${field.name}"]`));
  if (field.label) candidates.push(page.getByLabel(field.label, { exact: false }));

  for (const candidate of candidates) {
    try {
      if ((await candidate.count()) > 0) {
        return candidate.first();
      }
    } catch {
      // An invalid selector: try the next way of finding it.
    }
  }

  return null;
}

async function highlight(locator: Locator) {
  await locator.evaluate((element) => {
    (element as HTMLElement).style.outline = "3px solid #f0913f";
    (element as HTMLElement).style.outlineOffset = "2px";
    element.scrollIntoView({ block: "center" });
  });
}

async function apply(page: Page, action: FillAction, resumePath: string | null) {
  const locator = await locate(page, action.field);

  if (!locator) {
    return "missing" as const;
  }

  switch (action.kind) {
    case "fill":
      await locator.fill(action.value);
      return "done" as const;
    case "select":
      await locator.selectOption({ label: action.value }).catch(() => locator.selectOption(action.value));
      return "done" as const;
    case "choose": {
      const option = page.locator(`${action.field.selector ?? `[name="${action.field.name}"]`}`).filter({ has: page.locator("xpath=.") });
      const byLabel = page.getByLabel(action.value, { exact: false }).first();

      if ((await byLabel.count()) > 0) {
        await byLabel.check();
        return "done" as const;
      }

      await option.first().check();
      return "done" as const;
    }
    case "attach-resume":
      if (!resumePath) {
        return "missing" as const;
      }

      await locator.setInputFiles(resumePath);
      return "done" as const;
    case "highlight":
      await highlight(locator);
      return "highlighted" as const;
  }
}

async function main() {
  const appUrl = readFlag("--app-url");
  const applicationId = readFlag("--application");

  if (!appUrl || !applicationId || !/^\d+$/.test(applicationId)) {
    console.error("Uso: npm run apply:fill -- --app-url <URL do app> --application <id da candidatura>");
    process.exit(1);
  }

  const kit = await loadKit(appUrl, applicationId);

  if (!kit.applyUrl) {
    throw new Error("Este kit não tem link de candidatura. Abra o formulário à mão.");
  }

  const resumePath = await downloadResume(appUrl, kit, applicationId);
  const plan = buildFillPlan(kit);

  mkdirSync(path.resolve("tmp", "apply-profile"), { recursive: true });

  const context = await chromium.launchPersistentContext(path.resolve("tmp", "apply-profile"), {
    headless: false,
    viewport: null,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`Abrindo ${kit.applyUrl}`);
  await page.goto(kit.applyUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const blocked = detectBlockedPage(await page.content());

  if (blocked) {
    console.log(
      blocked === "captcha"
        ? "A página pede verificação anti-robô (CAPTCHA). Não vou preencher nada: resolva na janela e preencha à mão (use o kit no app)."
        : "A página exige login. Entre na janela (o perfil fica salvo em tmp/apply-profile) e rode o comando de novo.",
    );
  } else {
    const outcome = { done: 0, highlighted: 0, missing: [] as string[] };

    for (const action of plan) {
      try {
        const result = await apply(page, action, resumePath);

        if (result === "done") outcome.done += 1;
        else if (result === "highlighted") outcome.highlighted += 1;
        else outcome.missing.push(action.field.label);
      } catch (error) {
        outcome.missing.push(`${action.field.label} (${error instanceof Error ? error.message.split("\n")[0] : "erro"})`);
      }
    }

    const summary = summarizePlan(plan);

    console.log(`\nPreenchidos: ${outcome.done} (planejados: ${summary.filled + summary.attached}).`);
    console.log(`Destacados para você (laranja): ${outcome.highlighted}.`);

    if (outcome.missing.length > 0) {
      console.log(`Não encontrei na página:\n  - ${outcome.missing.join("\n  - ")}`);
    }
  }

  console.log("\nConfira tudo e envie você mesmo. Este script não envia nada. Feche a janela para terminar.");

  // Stay open until the user closes the browser.
  await new Promise<void>((resolve) => context.on("close", () => resolve()));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
