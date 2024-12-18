/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ixjb94/indicators"],
  experimental: {
    serverComponentsExternalPackages: ["@project-serum/anchor"],
  },
  reactStrictMode: false,
};

module.exports = nextConfig;
