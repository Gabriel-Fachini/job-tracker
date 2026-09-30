import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";

import type { FieldType, FormExtraction, FormField } from "./types";

/**
 * Reads a rendered application form (static HTML or a browser's `page.content()`)
 * into `FormField[]`. Groups radios/checkboxes, resolves labels, skips hidden and
 * submit controls. Never interacts with the page.
 */

const EEO_PATTERN =
  /\b(gender|race|ethnic\w*|hispanic|latino|veteran|disabilit\w*|sexual\s+orientation|pronouns?|transgender|demographic|self-?identif\w*|eeo|protected\s+class)\b/i;

export function isEeoText(...values: Array<string | undefined>): boolean {
  return values.some((value) => (value ? EEO_PATTERN.test(value) : false));
}

function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").replace(/[*✱]+/g, "").trim();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function fieldType(element: Cheerio<AnyNode>): FieldType {
  const tag = (element.prop("tagName") ?? "").toString().toLowerCase();

  if (tag === "textarea") return "textarea";
  if (tag === "select") return "select";

  const type = (element.attr("type") ?? "text").toLowerCase();

  switch (type) {
    case "text":
    case "search":
      return "text";
    case "email":
    case "tel":
    case "url":
    case "number":
    case "radio":
    case "checkbox":
    case "file":
      return type;
    default:
      return "other";
  }
}

/** Text of the closest label-like element for a control. */
function labelFor($: cheerio.CheerioAPI, element: Cheerio<AnyNode>): string {
  const aria = clean(element.attr("aria-label"));

  if (aria) {
    return aria;
  }

  const id = element.attr("id");

  if (id) {
    const explicit = $(`label[for="${id.replace(/"/g, '\\"')}"]`).first();

    if (explicit.length > 0) {
      const text = clean(explicit.find(".application-label, .label-text").first().text() || explicit.clone().children("input,select,textarea").remove().end().text());

      if (text) {
        return text;
      }
    }
  }

  const wrapping = element.closest("label");

  if (wrapping.length > 0) {
    const text = clean(wrapping.find(".application-label").first().text() || wrapping.clone().find("input,select,textarea,.application-field").remove().end().text());

    if (text) {
      return text;
    }
  }

  const container = element.closest("li, fieldset, .field, .form-group, [class*='question'], [class*='field']");

  if (container.length > 0) {
    const text = clean(container.find("legend, .application-label, label").first().text());

    if (text) {
      return text;
    }
  }

  return clean(element.attr("placeholder")) || clean(element.attr("name")) || clean(id);
}

function optionLabel($: cheerio.CheerioAPI, element: Cheerio<AnyNode>): string {
  const wrapping = element.closest("label");
  const text = clean(wrapping.length > 0 ? wrapping.text() : "");

  return text || clean(element.attr("value"));
}

function isRequired(element: Cheerio<AnyNode>): boolean {
  return (
    element.attr("required") !== undefined ||
    element.attr("aria-required") === "true" ||
    element.closest("li, fieldset, .field").find(".required, [class*='required']").length > 0
  );
}

export function extractFormFieldsFromHtml(html: string, options: { formSelector?: string } = {}): FormField[] {
  const $ = cheerio.load(html);
  const scope = options.formSelector && $(options.formSelector).length > 0 ? $(options.formSelector).first() : $("body");
  const fields: FormField[] = [];
  const byGroup = new Map<string, FormField>();

  scope.find("input, textarea, select").each((_, node) => {
    const element = $(node);
    const type = fieldType(element);
    const inputType = (element.attr("type") ?? "").toLowerCase();

    if (["hidden", "submit", "button", "reset", "image", "password"].includes(inputType)) {
      return;
    }

    if (element.attr("disabled") !== undefined || element.attr("aria-hidden") === "true") {
      return;
    }

    const name = element.attr("name") || undefined;
    const id = element.attr("id") || undefined;

    if (!name && !id && !element.attr("aria-label")) {
      return;
    }

    if (type === "radio" || type === "checkbox") {
      const groupKey = `${type}:${name ?? id}`;
      const option = optionLabel($, element);
      const existing = byGroup.get(groupKey);

      if (existing) {
        if (option) existing.options = [...(existing.options ?? []), option];
        return;
      }

      const label = labelFor($, element);
      const groupLabel = clean(element.closest("fieldset, li, .field, .form-group").find("legend, .application-label").first().text()) || label;
      const field: FormField = {
        id: slug(name ?? id ?? groupLabel) || `field_${fields.length + 1}`,
        label: groupLabel || label,
        name,
        selector: name ? `[name="${name}"]` : id ? `#${id}` : undefined,
        type,
        required: isRequired(element),
        options: option ? [option] : [],
      };

      field.eeo = isEeoText(field.label, name) || undefined;
      byGroup.set(groupKey, field);
      fields.push(field);
      return;
    }

    const label = labelFor($, element);
    const field: FormField = {
      id: slug(name ?? id ?? label) || `field_${fields.length + 1}`,
      label,
      name,
      selector: name ? `[name="${name}"]` : id ? `#${id}` : undefined,
      type,
      required: isRequired(element),
    };

    if (type === "select") {
      field.options = element
        .find("option")
        .map((__, option) => clean($(option).text()))
        .get()
        .filter((text) => text && !/^(select|choose|please)\b/i.test(text));
    }

    field.eeo = isEeoText(label, name) || undefined;
    fields.push(field);
  });

  // Ids must be unique within a form.
  const seen = new Map<string, number>();

  for (const field of fields) {
    const count = (seen.get(field.id) ?? 0) + 1;

    seen.set(field.id, count);

    if (count > 1) {
      field.id = `${field.id}_${count}`;
    }
  }

  return fields;
}

export type BlockedReason = "captcha" | "login";

/** A login wall or a bot check: the fill stops and the user takes over. */
export function detectBlockedPage(html: string): BlockedReason | null {
  const $ = cheerio.load(html);
  const text = $("body").text().toLowerCase();

  if (
    $("[class*='g-recaptcha'], [class*='h-captcha'], iframe[src*='recaptcha'], iframe[src*='hcaptcha'], [class*='cf-turnstile'], iframe[src*='challenges.cloudflare.com']").length > 0 ||
    /verify (that )?you are (a )?human|are you a robot|checking your browser before/.test(text)
  ) {
    return "captcha";
  }

  const controls = $("input:not([type=hidden]), textarea, select").length;

  if (
    $("input[type=password]").length > 0 &&
    (controls <= 4 || /sign in to (continue|apply)|log ?in to (continue|apply)/.test(text))
  ) {
    return "login";
  }

  return null;
}

export function extractionFromHtml(html: string, via: FormExtraction["via"], formSelector?: string): FormExtraction {
  const blocked = detectBlockedPage(html);

  if (blocked) {
    return { fields: [], blocked, via };
  }

  return { fields: extractFormFieldsFromHtml(html, { formSelector }), via };
}
