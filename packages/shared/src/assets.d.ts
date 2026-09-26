// Image imports resolve to a URL string (Vite), a `{ src }` object (Next) or
// an asset number (Metro); stylexn's Image takes all three.
declare module "*.png" {
  const source: import("stylexn/elements").ImageSource;
  export default source;
}
