import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // baileys (WhatsApp Web provider) dynamically imports optional media
  // libraries (jimp/sharp) it doesn't require for plain text sending,
  // wrapped in its own try/catch — bundling it would make Turbopack try to
  // statically resolve those imports and fail since neither is installed.
  // Externalizing lets Node's own require handle it at runtime instead,
  // where baileys' own fallback already does the right thing.
  serverExternalPackages: ["baileys"],
  async redirects() {
    return [
      // Sections used to be a page of their own; they're managed inside a class
      // now, so anyone still holding the old link lands somewhere useful.
      { source: "/school/sections", destination: "/school/classes", permanent: false },
    ];
  },
};

export default nextConfig;
