// ─────────────────────────────────────────────────────────────────────────────
// Together, Apart — environment switch.
//
// These values are filled in → the app runs on Supabase (no Node server needed).
// Blank them out ('') to go back to fully self-hosted mode (npm start).
//
// The key below is the PUBLIC key (the "publishable" key on newer projects,
// or the "anon public" key on older ones). It is designed to be public —
// row-level security from supabase/schema.sql protects the data.
// NEVER put the sb_secret_… / service_role key in this file.
//
// Full walkthrough: SETUP-SUPABASE.md
// ─────────────────────────────────────────────────────────────────────────────
window.__TA_ENV__ = {
  supabaseUrl: 'https://wltizwwsvmidcqroaztx.supabase.co',
  supabaseAnonKey: 'sb_publishable_JPeDkNGBsDhmzkwyjywlxA_1acPilF4',
};
