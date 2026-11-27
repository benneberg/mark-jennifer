import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

/**
 * Content-Security-Policy for the built app only. Injecting it via a build-time
 * plugin keeps `npm run dev` working (Vite's HMR preamble is an inline script)
 * while the deployed bundle gets the strict policy ARCHITECTURE.md documents.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Google Fonts: stylesheet from fonts.googleapis.com, font files from fonts.gstatic.com.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  // Only the AI providers the app can call directly, plus the Pages origin itself.
  "connect-src 'self' https://api.groq.com https://openrouter.ai https://api.openai.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicyPlugin() {
  return {
    name: 'inject-content-security-policy',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`
      );
    },
  };
}

export default defineConfig(() => {
  const rawBase = process.env.VITE_BASE_PATH?.trim() || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicyPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname ?? '.', '.'),
      },
    },
    server: {
      // Dev-server host allowlist: localhost plus the ephemeral preview domains
      // used by sandbox environments. Extend with VITE_ALLOWED_HOSTS=a,b.
      allowedHosts: [
        'localhost',
        '.e2b.app',
        ...(process.env.VITE_ALLOWED_HOSTS?.split(',').map((h) => h.trim()).filter(Boolean) ?? []),
      ],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
