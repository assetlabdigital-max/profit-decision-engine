/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep pg/pdf-parse style native deps out of the Edge/Server bundle
  // analysis where it doesn't belong. Server Components/Route Handlers
  // already run in Node by default; this just silences over-eager
  // bundling warnings for optional native bindings some pg versions ship.
  experimental: {
    serverComponentsExternalPackages: ["pg"],
  },
};

module.exports = nextConfig;
