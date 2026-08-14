const REQUIRED_PREVIEW_MESSAGE = "Vercel Preview requires SUPABASE_URL and SUPABASE_ANON_KEY.";

function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function buildBrowserRuntimeConfig(environment = process.env) {
  const preview = readText(environment.VERCEL_ENV) === "preview";
  const supabaseUrl = withoutTrailingSlash(readText(environment.SUPABASE_URL));
  const supabaseAnonKey = readText(environment.SUPABASE_ANON_KEY);

  if (preview && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error(REQUIRED_PREVIEW_MESSAGE);
  }

  const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);
  const generationEnabled = supabaseEnabled && readText(environment.AI_GENERATION_ENABLED) === "true";
  const illustrationEnabled = supabaseEnabled && readText(environment.IMAGE_GENERATION_ENABLED) === "true";
  const paymentsEnabled = supabaseEnabled && readText(environment.PAYMENTS_ENABLED) === "true";

  return Object.freeze({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_ENABLED: supabaseEnabled,
    GENERATION_MINI_GAMES_ENABLED: false,
    GENERATION_API_ENABLED: generationEnabled,
    GENERATION_API_URL: generationEnabled ? "/api/generate-story" : "",
    ILLUSTRATION_API_ENABLED: illustrationEnabled,
    ILLUSTRATION_API_URL: illustrationEnabled ? "/api/generate-story-illustration" : "",
    ILLUSTRATION_SIGNING_API_URL: supabaseEnabled ? "/api/get-story-illustration-url" : "",
    PAYMENT_API_URL: paymentsEnabled ? "/api/create-checkout" : ""
  });
}

export function renderBrowserRuntimeConfig(config) {
  return "(function (window) {\n  \"use strict\";\n\n  window.HFConfig = " +
    JSON.stringify(config, null, 2) +
    ";\n})(window);\n";
}
