/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable server components for better performance
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // Optimize for production builds
  swcMinify: true,
  // Enable strict mode for better development experience
  reactStrictMode: true,
  // Configure environment variables
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  // Configure redirects for tenant-aware routing
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/overview',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
