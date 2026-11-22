import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer, resolvePublic } from "./serve.mjs";

test("resolvePublic stays inside the site directory", () => {
  const dir = path.resolve("public");
  assert.equal(resolvePublic(dir, "/../secret").status, 400);
  assert.equal(resolvePublic(dir, "/%2e%2e/secret").status, 400);
  assert.equal(resolvePublic(dir, "/spec/").abs, path.join(dir, "spec"));
});

test("the local server serves pages, redirects directories, and uses 404.html", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "oadf-serve-"));
  fs.mkdirSync(path.join(dir, "spec"));
  fs.writeFileSync(path.join(dir, "index.html"), "home");
  fs.writeFileSync(path.join(dir, "spec", "index.html"), "spec");
  fs.writeFileSync(path.join(dir, "404.html"), "missing");
  const server = createServer(dir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.equal(await home.text(), "home");
    const redirect = await fetch(`${base}/spec`, { redirect: "manual" });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get("location"), "/spec/");
    const spec = await fetch(`${base}/spec/`);
    assert.equal(await spec.text(), "spec");
    const missing = await fetch(`${base}/nope`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "missing");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
