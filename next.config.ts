import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  // Keep these out of the server bundle so their internal file resolution
  // (e.g. pdfjs-dist's pdf.worker.mjs) works against node_modules at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "mammoth"],
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
