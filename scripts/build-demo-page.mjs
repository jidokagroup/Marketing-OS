/**
 * Wraps the shareable demo fragment into a standalone HTML document.
 *
 * The demo is authored as an Artifact, which supplies its own
 * <!doctype>/<html>/<head>/<body> at publish time. Serving the same file from
 * public/ needs that skeleton written in, plus the viewport and social meta
 * tags the Artifact host would otherwise add.
 *
 * Usage: node scripts/build-demo-page.mjs <fragment.html> <out.html>
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , src, out] = process.argv;
if (!src || !out) {
  console.error("usage: node scripts/build-demo-page.mjs <fragment> <out>");
  process.exit(1);
}

const fragment = readFileSync(src, "utf8");
if (/<!doctype/i.test(fragment)) {
  console.error(`${src} already looks like a full document — nothing to wrap.`);
  process.exit(1);
}

const title =
  /<title>([\s\S]*?)<\/title>/i.exec(fragment)?.[1]?.trim() ??
  "Convia Pro × Jidoka";

// The fragment opens with <title> and the Google Fonts <link>s. Those belong
// in <head>, so lift them out rather than leaving them stranded in <body>.
const head = [];
const body = fragment.replace(
  /^\s*(?:<title>[\s\S]*?<\/title>|<link\b[^>]*>)\s*/gim,
  (match) => {
    head.push(match.trim());
    return "";
  },
);
const description =
  "Interactive demo: one recording becomes every asset, across three " +
  "compounding cycles.";

// A visible build stamp, so "is this the new one?" has an answer that does not
// depend on spotting a copy change.
const build = new Date().toISOString().replace(/\.\d+Z$/, "Z");

writeFileSync(
  out,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="robots" content="index, follow">
<meta name="demo-build" content="${build}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta name="twitter:card" content="summary_large_image">
${head.join("\n")}
<style>*,*::before,*::after{box-sizing:border-box}
body{margin:0}img,svg,video{max-width:100%}</style>
</head>
<body>
${body.trim()}
<script>console.info("Convia Pro \u00d7 Jidoka demo \u2014 build ${build}");</script>
</body>
</html>
`,
);

console.log(`wrote ${out} — build ${build}, ${head.length} head tags lifted, ${body.length} bytes of body`);
