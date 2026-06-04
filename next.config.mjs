/** @type {import('next').NextConfig} */
const qaDistDir = process.env.TASKFLOW_QA_DIST_DIR?.trim();

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "10.0.39.234", "172.20.10.2"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb"
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

if (qaDistDir) {
  nextConfig.distDir = qaDistDir;
}

export default nextConfig;
