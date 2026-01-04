import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // For GitHub Pages deployment - deploying to public repo
  base: '/alpha-mirage/',
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  // Server config - enables both localhost and network access
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    port: 5173,
    strictPort: false, // If port is taken, try next available
    open: false, // Don't auto-open browser
  },
  build: {
    outDir: 'dist',
    // SECURITY: No source maps in production - prevents code inspection
    sourcemap: false,
    // SECURITY: Advanced minification with Terser
    minify: 'terser',
    terserOptions: {
      // SECURITY: Aggressive compression
      compress: {
        drop_console: true,       // Remove ALL console.log statements
        drop_debugger: true,      // Remove debugger statements
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3,                // Multiple compression passes
        dead_code: true,          // Remove unreachable code
        conditionals: true,       // Optimize if-s and conditional expressions
        evaluate: true,           // Evaluate constant expressions
        booleans: true,           // Optimize boolean expressions
        loops: true,              // Optimize loops
        unused: true,             // Drop unreferenced functions/variables
        hoist_funs: true,         // Hoist function declarations
        hoist_vars: false,        // Don't hoist var declarations (can break code)
        if_return: true,          // Optimize if-s followed by return/continue
        join_vars: true,          // Join consecutive var statements
        reduce_vars: true,        // Inline single-use variables
        collapse_vars: true,      // Collapse variables assigned with same value
        toplevel: true,           // Drop unreferenced top-level scope
      },
      // SECURITY: Aggressive name mangling
      mangle: {
        toplevel: true,           // Mangle top-level variable/function names
        eval: true,               // Mangle names visible in eval
        properties: {
          regex: /^_/,            // Only mangle properties starting with _
        },
      },
      // SECURITY: Remove all comments
      format: {
        comments: false,          // Remove all comments
        beautify: false,          // Don't beautify output
        ecma: 2020,               // Modern JavaScript output
      },
    },
    // SECURITY: Chunk splitting to obscure code structure
    rollupOptions: {
      output: {
        // Randomize chunk names to obscure structure
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
        // Minimize chunk names
        manualChunks: (id) => {
          // Combine all node_modules into vendor chunk
          if (id.includes('node_modules')) {
            return 'v';
          }
          // Group all app code together
          if (id.includes('/src/')) {
            return 'a';
          }
        },
      },
    },
    // Inline small assets to reduce file count
    assetsInlineLimit: 4096,
  },
  // SECURITY: Remove identifying information
  define: {
    // Remove React DevTools in production
    '__REACT_DEVTOOLS_GLOBAL_HOOK__': 'undefined',
  },
});
