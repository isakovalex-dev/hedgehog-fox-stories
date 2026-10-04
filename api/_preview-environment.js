"use strict";

const PREVIEW_STAGING_SUPABASE_URL = "https://opcnhhujyckmccvvpihc.supabase.co";
const PREVIEW_SUPABASE_URL_ERROR =
  "Vercel Preview requires SUPABASE_URL to be https://opcnhhujyckmccvvpihc.supabase.co.";

function normalizeSupabaseUrl(value) {
  return typeof value === "string" ? value.replace(/\/+$/, "") : "";
}

function isPreview(environment = process.env) {
  return environment?.VERCEL_ENV === "preview";
}

function assertPreviewSupabaseUrl(environment = process.env) {
  const supabaseUrl = normalizeSupabaseUrl(environment?.SUPABASE_URL);

  if (isPreview(environment) && supabaseUrl !== PREVIEW_STAGING_SUPABASE_URL) {
    const error = new Error(PREVIEW_SUPABASE_URL_ERROR);
    error.code = "preview_supabase_url_invalid";
    throw error;
  }

  return supabaseUrl;
}

function isPaidFeatureEnabled(name, environment = process.env) {
  return !isPreview(environment) && environment?.[name] === "true";
}

module.exports = {
  PREVIEW_STAGING_SUPABASE_URL,
  assertPreviewSupabaseUrl,
  isPaidFeatureEnabled,
  isPreview,
  normalizeSupabaseUrl
};
