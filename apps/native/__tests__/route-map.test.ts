// Sanity-check that every route file in app/ has a `export default`
// declaration. require()'ing route files at test time would pull in
// expo-video / expo-router native shims that aren't safe in the jest
// environment, so we do this with a static text scan.

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const appDir = join(__dirname, "..", "app");

const collectRouteFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectRouteFiles(full));
    } else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
};

describe("Route files", () => {
  const files = collectRouteFiles(appDir);

  it("collects more than five route files (smoke check)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("every app/**/*.tsx has an export default", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src).toMatch(/export default/);
    }
  });
});
