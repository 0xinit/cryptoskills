import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["rehype-pretty-code", "shiki"],
};

export default nextConfig;
