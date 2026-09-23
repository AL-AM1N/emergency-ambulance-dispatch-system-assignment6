import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/server.ts", "src/app.ts"],

	format: ["esm"], // ESM only — avoids import.meta breakage in the generated Prisma client

	target: "esnext",

	outDir: "dist",

	clean: true,

	bundle: true,

	splitting: false,

	sourcemap: true,

	// Add this banner to shim require() for CJS dependencies
	banner: {
		js: `
   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);
  `,
	},
});