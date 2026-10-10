// Metro resolves image imports to an asset number (the shared examples
// import PNGs; stylexn's Image passes the number to React Native's Image).
declare module "*.png" {
  const asset: number;
  export default asset;
}
