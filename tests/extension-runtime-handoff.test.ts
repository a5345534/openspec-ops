import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("guided extension runtime handoff", () => {
  const source = readFileSync(
    resolve(process.cwd(), ".pi/extensions/openspec-ops-guided.ts"),
    "utf8",
  );

  it("resolves package-affine runtime once and preserves explicit env", () => {
    expect(source).toContain(
      "const opsRuntime = resolveOpsBinDetailed({ projectRoot: PACKAGE_ROOT })",
    );
    expect(source).toContain(
      "if (opsRuntime.ok && !process.env.OPENSPEC_OPS_BIN)",
    );
    expect(source).toContain("process.env.OPENSPEC_OPS_BIN = opsRuntime.path");
    expect(source).toContain("formatOpsRuntimeBinding(opsRuntime)");
  });

  it("gates deliver before metrics attempt or follow-up scheduling", () => {
    const block = source.slice(
      source.indexOf('pi.registerCommand("ops-deliver"'),
      source.indexOf("  });\n}", source.indexOf('pi.registerCommand("ops-deliver"')),
    );
    const gate = block.indexOf("if (!opsRuntime.ok)");
    const attempt = block.indexOf("beginDeliver(");
    const followup = block.indexOf("buildDeliverFollowup(");
    const send = block.indexOf("pi.sendUserMessage(");
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(gate).toBeLessThan(attempt);
    expect(attempt).toBeLessThan(followup);
    expect(followup).toBeLessThan(send);
  });

  it("defers both guided slash handoffs and keeps follow-up delivery", () => {
    expect(source.match(/deferFollowUpHandoff\(\{/g)).toHaveLength(2);
    expect(source.match(/pi\.sendUserMessage\(message, sendOptions\)/g)).toHaveLength(2);
    expect(source).toContain("Queued follow-up:");
    expect(source).toContain("Follow-up was not queued:");
    expect(source).toContain("ops-deliver queued for");
    expect(source).toContain("ops-deliver was not queued for");
    expect(source).not.toContain("ops-deliver scheduled for");
    expect(source).not.toContain('deliverAs: "steer"');
  });

  it("tracks genuine operator language and injects it into every handoff", () => {
    expect(source).toContain('event.source !== "extension"');
    expect(source).toContain("inferResponseLanguage(text, responseLanguage)");
    expect(source).toContain("restoreResponseLanguage(ctx.sessionManager.getEntries())");
    expect(source).toContain("formatResponseLanguageContract(responseLanguage)");
    expect(source).toContain("responseLanguageContract:");
    expect(source).toContain("RESPONSE_LANGUAGE_ENTRY_TYPE");
  });

  it("injects runtime context without writing project configuration", () => {
    const before = source.slice(
      source.indexOf('pi.on("before_agent_start"'),
      source.indexOf('pi.registerCommand("ops-start"'),
    );
    expect(before).toContain("opsRuntimeBlock");
    expect(before).not.toContain("writeFile");
    expect(before).not.toContain("settings.json");
  });
});
