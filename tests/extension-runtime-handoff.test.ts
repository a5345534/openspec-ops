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
