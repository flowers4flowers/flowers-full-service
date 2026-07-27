/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flowersfullservice.warm-rice.dev',
      },
      {
        protocol: 'http',
        hostname: 'flowers.local.com:8888',
      },
      {
        protocol: 'http',
        hostname: 'flowers.local.com',
      },
      {
        protocol: 'https',
        hostname: 'admin.flowersfullservice.art',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/work',
        destination: '/',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
