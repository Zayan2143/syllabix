// Production backend. `npm run demo` swaps this file for backend.demo.ts at build time (see vite.config.ts).
export { createSupabaseApi as createBackend } from './supabaseApi';
