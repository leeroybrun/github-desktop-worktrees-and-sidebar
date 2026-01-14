import { describe, it } from 'node:test'
import assert from 'node:assert'
import { realpath } from 'fs/promises'
import { join } from 'path'

import { createTempDirectory } from '../../helpers/temp'
import { setupEmptyRepositoryDefaultMain } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'
import {
  addDetachedWorktree,
  addWorktree,
  listWorktrees,
} from '../../../src/lib/git/worktree'
import { git } from '../../../src/lib/git'

describe('git/worktree', () => {
  it('lists main and linked worktrees and parses branch names', async t => {
    const repo = await setupEmptyRepositoryDefaultMain(t)
    await makeCommit(repo, { entries: [{ path: 'a.txt', contents: 'a' }] })

    const parent = await createTempDirectory(t)
    const worktreePath = join(parent, 'linked-worktree')

    await addWorktree(repo, worktreePath, 'feature', true, 'main')

    const worktrees = await listWorktrees(repo)
    assert.equal(worktrees.length, 2)

    const main = worktrees.find(w => w.branch === 'main')
    assert.ok(main)
    assert.equal(main.isMain, true)

    const linked = worktrees.find(w => w.branch === 'feature')
    assert.ok(linked)
    assert.equal(linked.isMain, false)
    assert.equal(await realpath(linked.path), await realpath(worktreePath))
  })

  it('returns branch=null for detached worktrees', async t => {
    const repo = await setupEmptyRepositoryDefaultMain(t)
    await makeCommit(repo, { entries: [{ path: 'a.txt', contents: 'a' }] })

    const head = await git(
      ['rev-parse', 'HEAD'],
      repo.path,
      'revParseHead'
    ).then(r => r.stdout.trim())

    const parent = await createTempDirectory(t)
    const worktreePath = join(parent, 'detached-worktree')

    await addDetachedWorktree(repo, worktreePath, head)

    const worktrees = await listWorktrees(repo)
    const expectedPath = await realpath(worktreePath)
    const detached = await (async () => {
      for (const w of worktrees) {
        if ((await realpath(w.path)) === expectedPath) {
          return w
        }
      }
      return null
    })()
    assert.ok(detached)
    assert.equal(detached.branch, null)
  })
})
