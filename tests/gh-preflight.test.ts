import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGhBackend,
  parseGitHubRepositoryFromRemoteUrl,
} from "../src/ship/backends/gh.js";
import { CliError } from "../src/types.js";

const originalPath = process.env.PATH;
const originalMode = process.env.FAKE_GH_MODE;

afterEach(() => {
  process.env.PATH = originalPath;
  if (originalMode === undefined) delete process.env.FAKE_GH_MODE;
  else process.env.FAKE_GH_MODE = originalMode;
});

function installFakeGh(): string {
  const dir = mkdtempSync(join(tmpdir(), "ops-fake-gh-"));
  const file = join(dir, "gh");
  writeFileSync(
    file,
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo "gh version test"; exit 0; fi
if [ "$1" = "auth" ]; then
  [ "$FAKE_GH_MODE" = "auth-fail" ] && echo "not logged in" >&2 && exit 1
  exit 0
fi
if [ "$1" = "repo" ]; then
  [ "$FAKE_GH_MODE" = "not-found" ] && echo "GraphQL: Could not resolve to a Repository" >&2 && exit 1
  [ "$FAKE_GH_MODE" = "unavailable" ] && echo "network unavailable" >&2 && exit 1
  echo '{"nameWithOwner":"org/repo"}'
  exit 0
fi
exit 2
`,
  );
  chmodSync(file, 0o755);
  process.env.PATH = `${dir}:${originalPath ?? ""}`;
  return dir;
}

function preflight(remoteUrl = "git@github.com:org/repo.git") {
  return createGhBackend().preflightRepository({
    cwd: process.cwd(),
    remote: "origin",
    remoteUrl,
  });
}

describe("parseGitHubRepositoryFromRemoteUrl", () => {
  it.each([
    ["git@github.com:org/repo.git", "org/repo"],
    ["https://github.com/org/repo.git", "org/repo"],
    ["ssh://git@github.com/org/repo.git", "org/repo"],
  ])("parses %s", (url, expected) => {
    expect(parseGitHubRepositoryFromRemoteUrl(url)).toBe(expected);
  });

  it.each([
    "https://gitlab.com/org/repo.git",
    "file:///tmp/repo.git",
    "https://github.com/org/too/many",
    "not-a-url",
  ])("rejects unsupported URL %s", (url) => {
    expect(parseGitHubRepositoryFromRemoteUrl(url)).toBeNull();
  });
});

describe("gh repository preflight", () => {
  it("accepts authenticated existing repository", () => {
    const dir = installFakeGh();
    try {
      process.env.FAKE_GH_MODE = "ok";
      expect(preflight()).toEqual({ repository: "org/repo" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails unsupported remote before invoking repository lookup", () => {
    const dir = installFakeGh();
    try {
      expect(() => preflight("https://gitlab.com/org/repo.git")).toThrowError(
        expect.objectContaining({ code: "remote_invalid" }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("distinguishes gh authentication failure", () => {
    const dir = installFakeGh();
    try {
      process.env.FAKE_GH_MODE = "auth-fail";
      try {
        preflight();
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe("github_auth_failed");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("distinguishes nonexistent GitHub repository", () => {
    const dir = installFakeGh();
    try {
      process.env.FAKE_GH_MODE = "not-found";
      try {
        preflight("https://github.com/org/does-not-exist.git");
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe(
          "github_repository_not_found",
        );
        expect((error as CliError).details.repository).toBe(
          "org/does-not-exist",
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("distinguishes other repository lookup failures", () => {
    const dir = installFakeGh();
    try {
      process.env.FAKE_GH_MODE = "unavailable";
      try {
        preflight();
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe(
          "github_repository_unavailable",
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
