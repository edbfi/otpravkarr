// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { variables } from "../env";

// SvelteKit 3 silently reads an undeclared private variable as undefined, so
// every env.NAME read through $lib/server/private-env must be declared in
// src/env.ts, and nothing should be declared that no code reads.
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|js|svelte)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("src/env.ts", () => {
  it("declares exactly the private variables the app reads", () => {
    const read = new Set<string>();
    for (const file of sourceFiles("src")) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("$lib/server/private-env")) continue;
      for (const match of source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\b/g)) {
        read.add(match[1] as string);
      }
      expect(source, relative("src", file)).not.toMatch(/\benv\[/);
    }
    expect([...read].sort()).toEqual(Object.keys(variables).sort());
  });

  it("leaves unset variables undefined and set values unchanged", async () => {
    for (const config of Object.values(variables)) {
      const validate = config.schema["~standard"].validate;
      expect(await validate(undefined)).toEqual({ value: undefined });
      expect(await validate("value")).toEqual({ value: "value" });
    }
  });
});
