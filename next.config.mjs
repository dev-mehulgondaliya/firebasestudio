/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin must run as a plain Node.js dependency, never bundled.
  serverExternalPackages: ["firebase-admin"],

  // The Node.js execution worker is spawned as a separate process, so make sure
  // its files are shipped with the server output.
  outputFileTracingIncludes: {
    "/api/execution/server": [
      "./workers/execution-worker/**",
      "./public/sandbox/serializer.js",
    ],
  },

  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ];
    return [
      {
        // Studio UI: never embeddable by other sites.
        source: "/((?!sandbox/).*)",
        headers: [...common, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }],
      },
      {
        // Browser execution sandbox: only Studio itself may frame it.
        source: "/sandbox/:path*",
        headers: [...common, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
};

export default nextConfig;
