/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist ships a Node-oriented canvas dependency it doesn't need in the browser.
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
