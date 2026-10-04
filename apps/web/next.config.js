/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@platform/agent-runtime",
    "@platform/planner",
    "@platform/models",
    "@platform/tools",
    "@platform/verification",
    "@platform/recovery",
    "@platform/codegen",
    "@platform/sandbox",
    "@platform/spec",
    "@platform/queue",
    "@platform/storage"
  ],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }
  }
};
module.exports = nextConfig;
