// A preview VERCEL_ENV changes canonical URLs and indexing; tests start as local.
delete process.env.VERCEL_ENV;
delete process.env.SITE_URL;
delete process.env.SEO_NOINDEX;

// Failure-path tests log on purpose, which buries real failures. TEST_LOGS=1 shows them; console.log stays on.
if (process.env.TEST_LOGS !== "1") {
  const quiet = (): void => {};
  console.info = quiet;
  console.warn = quiet;
  console.error = quiet;
}
