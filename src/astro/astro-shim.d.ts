// Astro components have no built-in TS types when imported from a .ts file.
// EmDash's Astro renderer accepts the imported component as-is, so a permissive
// shim is enough for the plugin's typecheck to pass.
declare module "*.astro" {
  const Component: unknown;
  export default Component;
}
