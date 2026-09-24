import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase Server Actions body size limit to allow media uploads (images/videos)
  // Une vidéo de 15 Mo → ~20 Mo en base64 → 40 Mo laisse la marge pour le JSON.
  experimental: {
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;