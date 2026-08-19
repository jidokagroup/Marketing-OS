import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  // Keep these out of the server bundle so their internal file resolution
  // (e.g. pdfjs-dist's pdf.worker.mjs) works against node_modules at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "mammoth"],
  // The interactive demo is a single self-contained HTML file in public/, not
  // a React route. This lets it be linked as a clean /demo rather than
  // /demo/index.html, so the URL is safe to put in a deck or an email.
  async rewrites() {
    return [{ source: "/demo", destination: "/demo/index.html" }];
  },
  outputFileTracingIncludes: {
    "/api/assets/upload": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
      "./node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs",
      "./node_modules/pdf-parse/dist/worker/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
