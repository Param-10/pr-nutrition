import { afterEach, describe, expect, it } from "vitest";
import { getPackageManagerCommand } from "../package-manager.mjs";

const originalNpmExecPath = process.env.npm_execpath;

afterEach(() => {
  if (originalNpmExecPath === undefined) {
    delete process.env.npm_execpath;
  } else {
    process.env.npm_execpath = originalNpmExecPath;
  }
});

describe("getPackageManagerCommand", () => {
  it("uses the invoking package manager through the current Node binary", () => {
    process.env.npm_execpath = "/fake/path/to/pnpm.cjs";
    expect(getPackageManagerCommand()).toEqual({
      command: process.execPath,
      argsPrefix: ["/fake/path/to/pnpm.cjs"],
    });
  });

  it("fails clearly when npm_execpath is missing", () => {
    delete process.env.npm_execpath;
    expect(() => getPackageManagerCommand()).toThrowError(
      /Run this script through corepack pnpm/,
    );
  });
});
