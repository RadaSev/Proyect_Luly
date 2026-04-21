// /** @type {import('next').NextConfig} */
// const repo = "Proyect_Luly";

// const nextConfig = {
//   output: "export",
//   basePath: `/${repo}`,
//   assetPrefix: `/${repo}/`,
//   trailingSlash: true,
//   images: {
//     unoptimized: true,
//   },
// };

// module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production"

const nextConfig = {
  output: "export",
  basePath: isProd ? "/Proyect_Luly" : "",
  assetPrefix: isProd ? "/Proyect_Luly/" : "",
}

module.exports = nextConfig