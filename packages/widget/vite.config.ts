import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FeedbackWidget',
      fileName: () => 'widget.js',
      formats: ['iife']
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Ensure all code is in a single file
        inlineDynamicImports: true
      }
    }
  },
  define: {
    // Inject Supabase URL and key at build time
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || 'https://bgjeaqpvsgfsfacnsilu.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SDttAKs-cBM9V4uDK9XRuw_2_5-UZoR'
    )
  }
});
