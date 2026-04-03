import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildWebDashboard, renderWebDashboard } from "./index";

describe("web dashboard", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
    temporaryDirectories.length = 0;
  });

  it("renders dashboard HTML from the demo hub", () => {
    const html = renderWebDashboard("Diagnostic board");
    expect(html).toContain("Diagnostic board");
    expect(html).toContain("fenix 7 Pro");
    expect(html).toContain("OpenSpec dashboard");
  });

  it("builds dashboard files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nouvelle-web-"));
    temporaryDirectories.push(directory);
    await buildWebDashboard(directory);

    const html = await readFile(join(directory, "index.html"), "utf8");
    expect(html).toContain("nouvelleApp Connect IQ Dashboard");
  });
});
