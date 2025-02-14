/** @type {import('next').NextConfig} */

const { createVanillaExtractPlugin } = require("@vanilla-extract/next-plugin")

const withVanillaExtract = createVanillaExtractPlugin()

const nextConfig = {
  reactStrictMode: true,
  typescript: {},
  distDir: ".next",
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  trailingSlash: true,
  swcMinify: true,
}

module.exports = withVanillaExtract(nextConfig)
