/** @type {import('next').NextConfig} */
const nextConfig = {
  // M0's Vite build didn't gate on type or lint errors; keep that so the
  // course can ship fast. Type errors still surface in the editor; they
  // just don't block a Vercel deploy.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
