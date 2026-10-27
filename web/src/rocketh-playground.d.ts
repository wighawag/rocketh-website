// `@rocketh/playground` is resolved by `vite.plugins.ts` to the build in the
// rocketh checkout, not installed in this package, so TypeScript is told
// about the one entry the site imports. Importing it defines the element.
declare module '@rocketh/playground/element';
