export const KNOWN_STAGING_SUPABASE_URL = "https://fyzrtqsnmnizoxgcqsjc.supabase.co";

/** Refuse every mutating RLS target except Timber's known staging project. */
export function assertKnownStagingTarget(target: string): void {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error("Refusing mutating RLS probes: TEST_SUPABASE_URL is not the known staging target.");
  }

  const expected = new URL(KNOWN_STAGING_SUPABASE_URL);
  const safe =
    url.protocol === expected.protocol &&
    url.hostname === expected.hostname &&
    url.port === "" &&
    (url.pathname === "" || url.pathname === "/") &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "";
  if (!safe) {
    throw new Error("Refusing mutating RLS probes: TEST_SUPABASE_URL is not the known staging target.");
  }
}
