const { test } = require("node:test");
const assert = require("node:assert/strict");

// No live Supabase/Postgres instance in this environment. What IS testable
// without one: getDb() must fail loudly and clearly when DATABASE_URL isn't
// configured, rather than the postgres-js driver throwing some opaque
// connection error later on first query.
test("getDb throws a clear error when DATABASE_URL is not configured", () => {
  delete require.cache[require.resolve("../../src/env")];
  delete require.cache[require.resolve("../../src/db/client")];

  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    delete require.cache[require.resolve("../../src/env")];
    delete require.cache[require.resolve("../../src/db/client")];
    const { getDb } = require("../../src/db/client");
    assert.throws(() => getDb(), /DATABASE_URL is not set/);
  } finally {
    if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    delete require.cache[require.resolve("../../src/env")];
    delete require.cache[require.resolve("../../src/db/client")];
  }
});
