import { RowIndexPath } from '../ui/lib/list/list-row-index-path'
import { Commit } from './commit'
import { GitHubRepository } from './github-repository'

/**
 * This is a type is used in conjunction with the drag and drop manager to
 * store and specify the types of data that are being dragged
 *
 * Thus, using a `|` here would allow us to specify multiple types of data that
 * can be dragged.
 */
export type DragData = CommitDragData | RepositoryDragData

export type CommitDragData = {
  type: DragType.Commit
  commits: ReadonlyArray<Commit>
}

export type RepositoryDragData = {
  type: DragType.Repository
  repositoryId: number
  repositoryName: string
  /** The folder ID the repository is being dragged from (if any) */
  sourceFolderId: number | null
}

export enum DragType {
  Commit,
  Repository,
}

export type CommitDragElement = {
  type: DragType.Commit
  commit: Commit
  selectedCommits: ReadonlyArray<Commit>
  gitHubRepository: GitHubRepository | null
}

export type RepositoryDragElement = {
  type: DragType.Repository
  repositoryId: number
  repositoryName: string
  sourceFolderId: number | null
}

export type DragElement = CommitDragElement | RepositoryDragElement

export enum DropTargetType {
  Branch,
  Commit,
  ListInsertionPoint,
  RepositoryFolder,
  RepositoryInsertionPoint,
}

export enum DropTargetSelector {
  Branch = '.branches-list-item',
  PullRequest = '.pull-request-item',
  Commit = '.commit',
  ListInsertionPoint = '.list-insertion-point',
  RepositoryFolder = '.repository-folder-header',
  RepositoryItem = '.repository-list-item',
}

export type BranchTarget = {
  type: DropTargetType.Branch
  branchName: string
}

export type CommitTarget = {
  type: DropTargetType.Commit
}

export type ListInsertionPointTarget = {
  type: DropTargetType.ListInsertionPoint
  data: DragData
  index: RowIndexPath
}

export type RepositoryFolderTarget = {
  type: DropTargetType.RepositoryFolder
  folderId: number
  folderName: string
}

export type RepositoryInsertionPointTarget = {
  type: DropTargetType.RepositoryInsertionPoint
  /** The folder the repository should be inserted into */
  targetFolderId: number | null
  /** The index within the folder where the repository should be inserted */
  targetIndex: number
}

/**
 * This is a type is used in conjunction with the drag and drop manager to
 * pass information about a drop target.
 */
export type DropTarget =
  | BranchTarget
  | CommitTarget
  | ListInsertionPointTarget
  | RepositoryFolderTarget
  | RepositoryInsertionPointTarget
