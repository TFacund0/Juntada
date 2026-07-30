// ─── Shared Test Helpers ─────────────────────────────────────────────────────
// `ws` is only ever used as a Map key by roomService/groupService, so a plain
// object stands in fine for a real socket in these tests.
function fakeSocket() {
  return {};
}

module.exports = { fakeSocket };
