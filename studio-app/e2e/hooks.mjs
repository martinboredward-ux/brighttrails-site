export async function resolve(spec, ctx, next) {
  if (spec === "@netlify/blobs") return { url: "file:///tmp/e2e/stub-blobs.mjs", shortCircuit: true };
  return next(spec, ctx);
}
