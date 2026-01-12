import { app } from 'electron'
import * as Path from 'path'

/**
 * Ensure this build can co-exist with the official GitHub Desktop app.
 *
 * If two Electron apps share the same `userData` directory, Chromium storage
 * (localStorage/IndexedDB) and other state can be locked or corrupted when
 * switching between them, leading to crashes at startup.
 *
 * We intentionally isolate this build's userData directory by default.
 *
 * Override behavior:
 * - Set `GITHUB_DESKTOP_USER_DATA_PATH` to an absolute path to fully control it.
 * - Set `GITHUB_DESKTOP_SHARE_USER_DATA=1` to disable isolation (not recommended).
 */
function configureUserDataPath() {
  if (process.env.GITHUB_DESKTOP_SHARE_USER_DATA === '1') {
    return
  }

  const explicit = process.env.GITHUB_DESKTOP_USER_DATA_PATH
  if (explicit && explicit.length > 0) {
    app.setPath('userData', explicit)
    return
  }

  const appData = app.getPath('appData')
  const baseName = app.getName()

  // Keep the suffix stable so users keep their settings across rebuilds.
  // This is intentionally different from the official app to allow cohabitation.
  const userDataDirName = `${baseName} (Worktrees Fork)`

  app.setPath('userData', Path.join(appData, userDataDirName))
}

configureUserDataPath()

// Load the real main process entry after userData is configured.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('./main')

