import * as Path from 'path'
import { readFile } from 'fs/promises'
import { Repository } from '../models/repository'

/**
 * Reads repository-scoped Copilot commit message instructions from:
 * `.github/copilot-commit-instructions.md`
 *
 * Returns `undefined` if the file doesn't exist or is empty.
 */
export async function getCopilotCommitInstructions(
  repository: Repository
): Promise<string | undefined> {
  const instructionsPath = Path.join(
    repository.path,
    '.github',
    'copilot-commit-instructions.md'
  )

  try {
    const contents = await readFile(instructionsPath, 'utf8')
    const trimmed = contents.trim()
    if (trimmed.length === 0) {
      return undefined
    }

    // Keep instructions reasonably bounded to avoid blowing up request sizes.
    // This is character-based (not byte-based), but good enough for typical markdown.
    const maxCharacters = 20_000
    if (trimmed.length > maxCharacters) {
      return (
        trimmed.slice(0, maxCharacters) +
        `\n\n[Instructions truncated to ${maxCharacters} characters.]`
      )
    }

    return trimmed
  } catch (e) {
    // Missing file is expected and should be silent.
    if (e?.code !== 'ENOENT') {
      log.warn(
        `Failed to read Copilot commit instructions at ${instructionsPath}`,
        e
      )
    }
    return undefined
  }
}
