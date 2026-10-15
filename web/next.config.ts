import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api");
const socketUrl = `${apiUrl.protocol === "https:" ? "wss:" : "ws:"}//${apiUrl.host}`;

// No nonces needed: every page is client-rendered from static assets
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://res.cloudinary.com;
  font-src 'self';
  connect-src 'self' ${apiUrl.origin} ${socketUrl} https://api.cloudinary.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader.replace(/\s{2,}/g, " ").trim() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
