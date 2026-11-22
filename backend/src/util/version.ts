// Which build is running: baked into the image by the release workflow (see Dockerfile), so the
// deployed version can be checked from /api/health. Local runs show 'dev' / 'unknown'.
const startedAt = new Date().toISOString()

export const versionInfo = () => ({
  commit: process.env.GIT_SHA || 'unknown',
  release: process.env.RELEASE || 'dev',
  builtAt: process.env.BUILT_AT || 'unknown',
  startedAt,
})
