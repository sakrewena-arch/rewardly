import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase Server Actions body size limit to allow media uploads (images/videos)
  // Per official docs: bodySizeLimit goes inside experimental.serverActions
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;