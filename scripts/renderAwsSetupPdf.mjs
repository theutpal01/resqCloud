import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const sources = [
  ["Documentation index", "docs/README.md"],
  ["AWS setup guide index", "docs/aws/README.md"],
  ["Individual AWS account and project setup", "docs/aws/individual-setup.md"],
  ["Project README", "README.md"],
  ["SQS first AWS demo", "docs/aws/sqs-demo.md"],
  ["Complete AWS service showcase", "docs/aws/service-showcase.md"],
  ["Aurora PostgreSQL", "docs/aws/aurora-postgresql.md"],
  ["AWS architecture", "docs/aws/architecture.md"],
  ["Deployment boundary", "docs/engineering/deployment.md"],
  ["Implementation status and production gates", "docs/project/status.md"],
];

function inline(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll("\r", "").split("\n");
  const html = [];
  let paragraph = [];
  let list = "";
  let code = null;
  let table = false;
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = "";
  };
  const closeTable = () => {
    if (table) html.push("</tbody></table>");
    table = false;
  };

  for (const line of lines) {
    if (code !== null) {
      if (line.startsWith("```")) {
        html.push(`<pre><code>${inline(code.join("\n"))}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      closeTable();
      code = [];
      continue;
    }
    const cells = line.trim().startsWith("|")
      ? line
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((x) => x.trim())
      : null;
    if (cells && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells) {
      flushParagraph();
      closeList();
      if (!table) {
        html.push("<table><tbody>");
        table = true;
      }
      const header = !html.at(-1)?.includes("</tr>");
      html.push(
        `<tr>${cells.map((cell) => `<${header ? "th" : "td"}>${inline(cell)}</${header ? "th" : "td"}>`).join("")}</tr>`,
      );
      continue;
    }
    closeTable();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const item = /^\s*(?:[-*+]\s+|(\d+)\.\s+)(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      const nextList = item[1] ? "ol" : "ul";
      if (list !== nextList) {
        closeList();
        list = nextList;
        html.push(`<${list}>`);
      }
      html.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    closeList();
    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph();
      html.push("<hr>");
    } else if (/^>\s?/.test(line)) {
      flushParagraph();
      html.push(
        `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`,
      );
    } else if (!line.trim()) flushParagraph();
    else paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  closeTable();
  return html.join("\n");
}

const sections = [];
for (const [title, file] of sources) {
  const markdown = await readFile(resolve(root, file), "utf8");
  sections.push(
    `<section class="document"><h1>${inline(title)}</h1><p class="source">Source: ${inline(file)}</p>${renderMarkdown(markdown)}</section>`,
  );
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>ResQCloud AWS and Project Setup Guide</title><style>
@page { size: A4; margin: 18mm 16mm 19mm; @bottom-right { content: "ResQCloud setup guide · " counter(page); color: #687385; font: 9pt Arial, sans-serif; } }
* { box-sizing: border-box; } body { color: #182230; font: 10pt/1.5 Arial, sans-serif; }
h1,h2,h3,h4 { color: #103a56; line-height: 1.2; break-after: avoid; } h1 { font-size: 23pt; margin: 0 0 5mm; } h2 { font-size: 16pt; margin: 8mm 0 3mm; } h3 { font-size: 12pt; margin: 6mm 0 2mm; } h4 { font-size: 10pt; }
p { margin: 0 0 3mm; } .source { color: #64748b; font-size: 9pt; margin-bottom: 8mm; } .document + .document { break-before: page; }
ul,ol { padding-left: 7mm; margin: 1mm 0 4mm; } li { margin: 0 0 1.3mm; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 8.5pt; } th,td { border: 1px solid #cbd5e1; padding: 2mm; text-align: left; vertical-align: top; } th { background: #eaf1f6; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f1f5f9; border: 1px solid #d5dee8; border-radius: 2mm; padding: 3mm; font: 8pt/1.35 ui-monospace, monospace; break-inside: avoid; } code { font-family: ui-monospace, monospace; font-size: .92em; background: #f1f5f9; padding: .2mm .6mm; overflow-wrap: anywhere; } pre code { background: transparent; padding: 0; }
a { color: #075985; text-decoration: underline; overflow-wrap: anywhere; } blockquote { border-left: 3px solid #94a3b8; margin: 3mm 0; padding: 1mm 4mm; color: #475569; } hr { border: 0; border-top: 1px solid #cbd5e1; margin: 6mm 0; }
</style></head><body><header><h1>ResQCloud: AWS Account and Project Setup</h1><p>Individual account setup, local development, AWS service integration, and project readiness references.</p><p>Prepared from the repository documentation. Review linked AWS service pricing and current account offers before creating resources.</p></header>${sections.join("\n")}</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ format: "A4" });
  await page.setContent(html, { waitUntil: "load" });
  const output = resolve(root, "docs/aws/ResQCloud-Individual-AWS-Setup.pdf");
  await page.pdf({ path: output, format: "A4", printBackground: true });
  console.log(`Created ${output}`);
} finally {
  await browser.close();
}
