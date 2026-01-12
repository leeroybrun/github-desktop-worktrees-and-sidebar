import { git } from './core'
import { Repository } from '../../models/repository'

/**
 * Represents a git worktree
 */
export interface IWorktree {
  /** The absolute path to the worktree */
  readonly path: string

  /** The SHA of the HEAD commit in this worktree */
  readonly head: string

  /** The branch checked out in this worktree, or null if detached HEAD */
  readonly branch: string | null

  /** Whether this is the main worktree (the original repository) */
  readonly isMain: boolean

  /** Whether this is a bare repository */
  readonly isBare: boolean

  /** Whether the worktree is locked */
  readonly isLocked: boolean

  /** Whether the worktree path is prunable (missing from disk) */
  readonly isPrunable: boolean
}

/**
 * Parse the output of `git worktree list --porcelain` into an array of worktrees
 *
 * The porcelain format outputs blocks separated by blank lines, with each block
 * containing information about a single worktree:
 *
 * worktree /path/to/main
 * HEAD abc123...
 * branch refs/heads/main
 *
 * worktree /path/to/linked
 * HEAD def456...
 * branch refs/heads/feature
 *
 * For bare repositories:
 * worktree /path/to/bare
 * bare
 *
 * For detached HEAD:
 * worktree /path/to/detached
 * HEAD abc123...
 * detached
 */
function parseWorktreeListOutput(output: string): IWorktree[] {
  const worktrees: IWorktree[] = []
  const blocks = output.trim().split('\n\n')

  for (const block of blocks) {
    if (!block.trim()) {
      continue
    }

    const lines = block.split('\n')
    let path = ''
    let head = ''
    let branch: string | null = null
    let isMain = false
    let isBare = false
    let isLocked = false
    let isPrunable = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.substring('worktree '.length)
      } else if (line.startsWith('HEAD ')) {
        head = line.substring('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        // Branch is in format refs/heads/branchname
        const fullBranch = line.substring('branch '.length)
        branch = fullBranch.replace(/^refs\/heads\//, '')
      } else if (line === 'bare') {
        isBare = true
      } else if (line === 'detached') {
        // HEAD is detached, branch stays null
      } else if (line === 'locked') {
        isLocked = true
      } else if (line === 'prunable') {
        isPrunable = true
      }
    }

    // The first worktree in the list is always the main worktree
    isMain = worktrees.length === 0

    if (path) {
      worktrees.push({
        path,
        head,
        branch,
        isMain,
        isBare,
        isLocked,
        isPrunable,
      })
    }
  }

  return worktrees
}

/**
 * List all worktrees for a repository
 *
 * @param repository - The repository to list worktrees for
 * @returns An array of worktree information
 */
export async function listWorktrees(
  repository: Repository
): Promise<IWorktree[]> {
  const result = await git(
    ['worktree', 'list', '--porcelain'],
    repository.path,
    'listWorktrees'
  )

  return parseWorktreeListOutput(result.stdout)
}

/**
 * Add a new worktree to a repository
 *
 * @param repository - The repository to add a worktree to
 * @param path - The path where the worktree should be created
 * @param branchOrCommit - The branch name or commit to check out in the worktree.
 *                         If it's a new branch, use createBranch parameter.
 * @param createBranch - If true, create a new branch with the given name
 * @param baseBranch - The base branch to create the new branch from (only used if createBranch is true)
 */
export async function addWorktree(
  repository: Repository,
  path: string,
  branchOrCommit: string,
  createBranch: boolean = false,
  baseBranch?: string
): Promise<void> {
  const args = ['worktree', 'add']

  if (createBranch) {
    args.push('-b', branchOrCommit)
    if (baseBranch) {
      args.push(path, baseBranch)
    } else {
      args.push(path)
    }
  } else {
    args.push(path, branchOrCommit)
  }

  await git(args, repository.path, 'addWorktree')
}

/**
 * Add a new detached worktree to a repository
 *
 * @param repository - The repository to add a worktree to
 * @param path - The path where the worktree should be created
 * @param commit - The commit to check out (detached HEAD)
 */
export async function addDetachedWorktree(
  repository: Repository,
  path: string,
  commit: string
): Promise<void> {
  await git(
    ['worktree', 'add', '--detach', path, commit],
    repository.path,
    'addDetachedWorktree'
  )
}

/**
 * Remove a worktree from a repository
 *
 * @param repository - The repository to remove a worktree from
 * @param path - The path of the worktree to remove
 * @param force - If true, remove even if the worktree is dirty or locked
 */
export async function removeWorktree(
  repository: Repository,
  path: string,
  force: boolean = false
): Promise<void> {
  const args = ['worktree', 'remove']

  if (force) {
    args.push('--force')
  }

  args.push(path)

  await git(args, repository.path, 'removeWorktree')
}

/**
 * Lock a worktree to prevent it from being pruned
 *
 * @param repository - The repository containing the worktree
 * @param path - The path of the worktree to lock
 * @param reason - An optional reason for locking the worktree
 */
export async function lockWorktree(
  repository: Repository,
  path: string,
  reason?: string
): Promise<void> {
  const args = ['worktree', 'lock']

  if (reason) {
    args.push('--reason', reason)
  }

  args.push(path)

  await git(args, repository.path, 'lockWorktree')
}

/**
 * Unlock a previously locked worktree
 *
 * @param repository - The repository containing the worktree
 * @param path - The path of the worktree to unlock
 */
export async function unlockWorktree(
  repository: Repository,
  path: string
): Promise<void> {
  await git(['worktree', 'unlock', path], repository.path, 'unlockWorktree')
}

/**
 * Move a worktree to a new location
 *
 * @param repository - The repository containing the worktree
 * @param oldPath - The current path of the worktree
 * @param newPath - The new path for the worktree
 * @param force - If true, move even if the worktree is locked
 */
export async function moveWorktree(
  repository: Repository,
  oldPath: string,
  newPath: string,
  force: boolean = false
): Promise<void> {
  const args = ['worktree', 'move']

  if (force) {
    args.push('--force')
  }

  args.push(oldPath, newPath)

  await git(args, repository.path, 'moveWorktree')
}

/**
 * Prune worktree information for worktrees that are no longer on disk
 *
 * @param repository - The repository to prune worktrees for
 * @param dryRun - If true, only report what would be pruned
 * @param expire - Prune worktrees older than the specified time (e.g., "3.months.ago")
 */
export async function pruneWorktrees(
  repository: Repository,
  dryRun: boolean = false,
  expire?: string
): Promise<string> {
  const args = ['worktree', 'prune']

  if (dryRun) {
    args.push('--dry-run')
  }

  if (expire) {
    args.push('--expire', expire)
  }

  // Add verbose flag to get info about what's being pruned
  args.push('--verbose')

  const result = await git(args, repository.path, 'pruneWorktrees')
  return result.stdout
}

/**
 * Repair worktree administrative files if possible
 *
 * @param repository - The repository to repair worktrees for
 * @param paths - Optional specific worktree paths to repair
 */
export async function repairWorktrees(
  repository: Repository,
  paths?: string[]
): Promise<void> {
  const args = ['worktree', 'repair']

  if (paths && paths.length > 0) {
    args.push(...paths)
  }

  await git(args, repository.path, 'repairWorktrees')
}

/**
 * Get a specific worktree by its path
 *
 * @param repository - The repository to search in
 * @param worktreePath - The path of the worktree to find
 * @returns The worktree if found, or null
 */
export async function getWorktree(
  repository: Repository,
  worktreePath: string
): Promise<IWorktree | null> {
  const worktrees = await listWorktrees(repository)
  return worktrees.find(wt => wt.path === worktreePath) || null
}

/**
 * Find the main worktree (the original repository)
 *
 * @param repository - The repository to search in
 * @returns The main worktree
 */
export async function getMainWorktree(
  repository: Repository
): Promise<IWorktree | null> {
  const worktrees = await listWorktrees(repository)
  return worktrees.find(wt => wt.isMain) || null
}

/**
 * Get all linked worktrees (excluding the main worktree)
 *
 * @param repository - The repository to search in
 * @returns An array of linked worktrees
 */
export async function getLinkedWorktrees(
  repository: Repository
): Promise<IWorktree[]> {
  const worktrees = await listWorktrees(repository)
  return worktrees.filter(wt => !wt.isMain)
}

/**
 * Check if a given path is part of any worktree in the repository
 *
 * @param repository - The repository to check
 * @param pathToCheck - The path to check
 * @returns True if the path is a worktree path
 */
export async function isWorktreePath(
  repository: Repository,
  pathToCheck: string
): Promise<boolean> {
  const worktrees = await listWorktrees(repository)
  return worktrees.some(wt => wt.path === pathToCheck)
}

/**
 * Find a worktree by the branch it has checked out
 *
 * @param repository - The repository to search in
 * @param branchName - The branch name to search for
 * @returns The worktree with the branch checked out, or null
 */
export async function getWorktreeForBranch(
  repository: Repository,
  branchName: string
): Promise<IWorktree | null> {
  const worktrees = await listWorktrees(repository)
  return worktrees.find(wt => wt.branch === branchName) || null
}
