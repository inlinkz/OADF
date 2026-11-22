import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(root);
const specPath = path.join(repo, "OADF.md");
const licensePath = path.join(repo, "LICENSE");
const exampleDir = path.join(repo, "example");
const outDir = path.join(root, "public");
const staticDir = path.join(root, "static");

const specMarkdown = fs.readFileSync(specPath, "utf8").replace(/\r\n/g, "\n");
const licenseText = fs.readFileSync(licensePath, "utf8").replace(/\r\n/g, "\n").trimEnd();

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value) {
  const escaped = escapeHtml(value);
  const withCode = escaped.replaceAll(/`([^`]+)`/g, "<code>$1</code>");
  return withCode.replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function slugify(value) {
  return value
    .replaceAll(/`/g, "")
    .replaceAll(/\*\*/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function parse(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let i = 0;

  const isSpecial = (line) =>
    line.startsWith("```") ||
    line.startsWith("|") ||
    /^#{1,3} /.test(line) ||
    /^- /.test(line) ||
    /^\d+\. /.test(line);

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang, text: body.join("\n") });
      continue;
    }

    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }

    const heading = /^(#{1,3}) (.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() !== "" && !isSpecial(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "p", text: paragraph.join(" ") });
  }

  return blocks;
}

function renderTable(rows) {
  const parsed = rows.map((row) =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()),
  );
  const header = parsed[0];
  const body = parsed.slice(1).filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
  const head = header.map((cell) => `<th>${inline(cell)}</th>`).join("");
  const bodyHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function renderBlocks(blocks) {
  const used = new Map();
  const toc = [];
  const html = blocks
    .map((block) => {
      if (block.type === "heading") {
        let id = slugify(block.text) || "section";
        const seen = used.get(id) ?? 0;
        used.set(id, seen + 1);
        if (seen > 0) id = `${id}-${seen + 1}`;
        if (block.level > 1) toc.push({ level: block.level, id, text: block.text });
        return `<h${block.level} id="${id}">${inline(block.text)}</h${block.level}>`;
      }
      if (block.type === "p") return `<p>${inline(block.text)}</p>`;
      if (block.type === "ul") return `<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`;
      if (block.type === "ol") return `<ol>${block.items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`;
      if (block.type === "code") {
        const cls = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : "";
        return `<pre><code${cls}>${escapeHtml(block.text)}</code></pre>`;
      }
      if (block.type === "table") return renderTable(block.rows);
      return "";
    })
    .join("\n");
  return { html, toc };
}

function layout({ title, description, pathName, current, body }) {
  const canonical = `https://oadf.dev${pathName}`;
  const nav = [
    ["/spec/", "Specification"],
    ["/example/", "Example"],
    ["/license/", "License"],
  ]
    .map(([href, label]) => {
      const currentAttr = href === current ? ' aria-current="page"' : "";
      return `<a href="${href}"${currentAttr}>${label}</a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/site.css">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="website">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/"><img src="/mark.svg" alt="">OADF</a>
    <nav class="site-nav" aria-label="Site">${nav}</nav>
  </header>
  <main id="content">${body}</main>
  <footer class="site-footer">
    <span>Open Archery Data Format, version 1</span>
    <a href="/license/">MIT License · akorbeti</a>
  </footer>
</body>
</html>
`;
}

function homePage() {
  const description =
    "OADF version 1 is a directory of YAML and CSV for archery training: clubs, people, programmes, sessions, scores, equipment, sensor series, and photos.";
  const body = `
  <div class="wrap">
    <p class="kicker">Version 1</p>
    <h1>Open Archery Data Format</h1>
    <p class="lede">A directory of YAML and CSV for archery training. The same package is meant to be read by a person, a statistics tool, or a language model.</p>
    <p>A package holds clubs, people, programmes, sessions, scores, equipment, sensor series, and photos. A zip is only transport: unpacking restores the same tree. The text of the <a href="/spec/">specification</a> is the contract. The <a href="/example/">worked package</a> is the oracle.</p>

    <h2>A package</h2>
    <p>The root holds <code>oadf.yaml</code>. Every path inside a document is relative to that root. This tree is the shape; the names are an illustration.</p>
    <pre class="tree">oadf.yaml
Athens Archery.club.yaml
people/maria.person.yaml
programmes/form-block.programme.yaml
archers/maria/2026-10-20.session.yaml
archers/maria/scorecards/2026-10-20-1820.scorecard.yaml
archers/maria/bulk/2026-10-20-1802.bulk.yaml
archers/maria/series/heart-2026-10-20.csv
archers/maria/media/end-1-1.jpg
archers/maria/equipment/indoor-recurve.equipment.yaml</pre>

    <h2>Documents</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>Type</th><th>File</th><th>Role</th></tr></thead>
      <tbody>
        <tr><td><code>manifest</code></td><td><code>oadf.yaml</code></td><td>Package version and optional index</td></tr>
        <tr><td><code>club</code></td><td><code>*.club.yaml</code></td><td>Members and coach→archer links</td></tr>
        <tr><td><code>person</code></td><td><code>*.person.yaml</code></td><td>One archer and/or coach</td></tr>
        <tr><td><code>programme</code></td><td><code>*.programme.yaml</code></td><td>Multi-session plan, no scores</td></tr>
        <tr><td><code>session_template</code></td><td><code>*.session-template.yaml</code></td><td>One practice plan, no date</td></tr>
        <tr><td><code>session</code></td><td><code>*.session.yaml</code></td><td>One dated practice</td></tr>
        <tr><td><code>scorecard</code></td><td><code>*.scorecard.yaml</code></td><td>Scored arrows</td></tr>
        <tr><td><code>bulk</code></td><td><code>*.bulk.yaml</code></td><td>Arrow counts without per-arrow scores</td></tr>
        <tr><td><code>equipment</code></td><td><code>*.equipment.yaml</code></td><td>One gear item and its revisions</td></tr>
        <tr><td>series</td><td><code>*.csv</code></td><td>Dense samples, as a sidecar</td></tr>
        <tr><td>media</td><td>jpg, png, webp, heic</td><td>Photos, as sidecars</td></tr>
      </tbody>
    </table></div>

    <h2>Rules that stay fixed in version 1</h2>
    <ul>
      <li>Every YAML document starts with <code>oadf: 1</code> and <code>type</code>.</li>
      <li>A score that was not entered is omitted. <code>M</code> or <code>0</code> is a miss. A blank is not a miss.</li>
      <li>Face plots use the centre as origin, +x right, +y up, and radius 10 at the outer edge.</li>
      <li>Times are UTC with a <code>Z</code> suffix. Dates are <code>YYYY-MM-DD</code>.</li>
      <li>Samples and photos stay in sidecar files. They are never inlined in YAML.</li>
      <li>Unknown keys are kept and written back unchanged.</li>
    </ul>
    <p>JSON with the same object shape is allowed. The file then ends in <code>.json</code>.</p>
  </div>`;
  return layout({
    title: "Open Archery Data Format",
    description,
    pathName: "/",
    current: "/",
    body,
  });
}

function specPage() {
  const { html, toc } = renderBlocks(parse(specMarkdown));
  const tocHtml = toc
    .map((item) => {
      const cls = item.level === 3 ? ' class="sub"' : "";
      return `<a href="#${item.id}"${cls}>${inline(item.text)}</a>`;
    })
    .join("");
  const body = `
  <div class="wrap spec">
    <nav class="toc" aria-label="Specification">
      <p>Contents</p>
      ${tocHtml}
    </nav>
    <article class="article">
      ${html}
    </article>
  </div>`;
  return layout({
    title: "Specification · Open Archery Data Format",
    description: "OADF version 1 specification: package layout, documents, scores, series, equipment, and conformance.",
    pathName: "/spec/",
    current: "/spec/",
    body,
  });
}

function walk(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(abs, rel));
    else if (entry.name !== "README.md") {
      files.push({ rel: rel.replaceAll("\\", "/"), bytes: fs.statSync(abs).size });
    }
  }
  return files;
}

function examplePage(files) {
  const list = files
    .map((file) => {
      const href = `/example/files/${file.rel.split("/").map(encodeURIComponent).join("/")}`;
      return `<li><a href="${href}">${escapeHtml(file.rel)}<span>${file.bytes} B</span></a></li>`;
    })
    .join("");
  const body = `
  <div class="wrap">
    <p class="kicker">Worked package</p>
    <h1>Example</h1>
    <p class="lede">One club evening at Trilofos Archery. Maria shoots a WA 18 at 18 metres. The files below are the oracle for version 1.</p>
    <p>Start at <a href="/example/files/oadf.yaml"><code>oadf.yaml</code></a>. Paths inside documents are relative to that directory. Elena coaches, Nikos coaches and shoots, and the session records a scored card, a bulk count, equipment revisions, sensor series, and photos.</p>
    <p>The story’s local clock is UTC+2. Every timestamp in the files is UTC with a <code>Z</code> suffix. The photographs are 1×1 placeholders so the paths resolve.</p>
    <h2>Files</h2>
    <ul class="file-list">${list}</ul>
  </div>`;
  return layout({
    title: "Example · Open Archery Data Format",
    description: "The OADF version 1 worked package: a Trilofos Archery session with scores, equipment, series, and photos.",
    pathName: "/example/",
    current: "/example/",
    body,
  });
}

function licensePage() {
  const body = `
  <div class="wrap">
    <p class="kicker">Version 1</p>
    <h1>License</h1>
    <p>The format and this site are published under the MIT License.</p>
    <pre class="license">${escapeHtml(licenseText)}</pre>
  </div>`;
  return layout({
    title: "License · Open Archery Data Format",
    description: "OADF version 1 is published under the MIT License.",
    pathName: "/license/",
    current: "/license/",
    body,
  });
}

function notFoundPage() {
  const body = `
  <div class="wrap">
    <p class="kicker">404</p>
    <h1>That page is not in the package.</h1>
    <p>The <a href="/spec/">specification</a> and the <a href="/example/">worked example</a> are.</p>
  </div>`;
  return layout({
    title: "Not found · Open Archery Data Format",
    description: "That page is not part of the OADF site.",
    pathName: "/404.html",
    current: "",
    body,
  });
}

function copyStatic() {
  fs.cpSync(staticDir, outDir, { recursive: true });
}

function copyExample() {
  const dest = path.join(outDir, "example", "files");
  fs.cpSync(exampleDir, dest, { recursive: true });
  fs.rmSync(path.join(dest, "README.md"), { force: true });
  return walk(dest);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
copyStatic();
const files = copyExample();
fs.writeFileSync(path.join(outDir, "index.html"), homePage());
fs.mkdirSync(path.join(outDir, "spec"), { recursive: true });
fs.writeFileSync(path.join(outDir, "spec", "index.html"), specPage());
fs.mkdirSync(path.join(outDir, "example"), { recursive: true });
fs.writeFileSync(path.join(outDir, "example", "index.html"), examplePage(files));
fs.mkdirSync(path.join(outDir, "license"), { recursive: true });
fs.writeFileSync(path.join(outDir, "license", "index.html"), licensePage());
fs.writeFileSync(path.join(outDir, "404.html"), notFoundPage());

const urls = ["https://oadf.dev/", "https://oadf.dev/spec/", "https://oadf.dev/example/", "https://oadf.dev/license/"];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap);
console.log(`Built ${files.length} example files into public/`);
