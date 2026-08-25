import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Sections used to be a page of their own; they're managed inside a class
      // now, so anyone still holding the old link lands somewhere useful.
      { source: "/school/sections", destination: "/school/classes", permanent: false },
    ];
  },
};

export default nextConfig;
