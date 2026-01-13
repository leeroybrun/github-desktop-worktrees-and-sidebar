import * as React from 'react'
import classNames from 'classnames'
import memoizeOne from 'memoize-one'
import { Disposable } from 'event-kit'

import { Dispatcher } from '../dispatcher'
import {
  IRepositoryFolder,
  RepositoryGroupingMode,
  IWorktreesState,
  IWorktreeState,
} from '../../lib/app-state'
import {
  Repository,
  ILocalRepositoryState,
  createRepositoryWithPath,
} from '../../models/repository'
import { CloningRepository } from '../../models/cloning-repository'
import {
  groupRepositories,
  IRepositoryListItem,
  Repositoryish,
} from '../repositories-list/group-repositories'
import { IFilterListGroup } from '../lib/filter-list'
import { SectionFilterList } from '../lib/section-filter-list'
import { IMatches } from '../../lib/fuzzy-find'
import { RepositoryListItem } from '../repositories-list/repository-list-item'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Draggable } from '../lib/draggable'
import { DragType, DropTarget, DropTargetType } from '../../models/drag-drop'
import { dragAndDropManager } from '../../lib/drag-and-drop-manager'
import { enableNestedWorktreesInSidebar } from '../../lib/feature-flag'
import { HighlightText } from '../lib/highlight-text'
import { TooltippedContent } from '../lib/tooltipped-content'
import { showContextualMenu } from '../../lib/menu-item'
import { PopupType } from '../../models/popup'
import { generateRepositoryListContextMenu } from '../repositories-list/repository-list-item-context-menu'

type FolderGroupIdentifier =
  | {
      kind: 'folder'
      folderId: number
      name: string
      isCollapsed: boolean
    }
  | { kind: 'ungrouped' }

interface IDockedRepositoryRowProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repositoryish
  readonly repoItem: IRepositoryListItem
  readonly matches: IMatches
  readonly hasExpand: boolean
  readonly isExpanded: boolean
  readonly folderId: number | null
  readonly indexInFolder: number
  readonly repositoryFolderAssignments: ReadonlyMap<number, number>
  /** Called when a repository drag starts */
  readonly onRepositoryDragStart?: (repository: Repositoryish) => void
  /** Called when a repository drag ends */
  readonly onRepositoryDragEnd?: (repository: Repositoryish) => void
  readonly onToggleRepositoryExpanded: (repositoryId: number) => void
}

class DockedRepositoryRow extends React.PureComponent<IDockedRepositoryRowProps> {
  private onMouseEnter = () => {
    if (!dragAndDropManager.isDragOfTypeInProgress(DragType.Repository)) {
      return
    }

    dragAndDropManager.emitEnterDropTarget({
      type: DropTargetType.RepositoryInsertionPoint,
      targetFolderId: this.props.folderId,
      targetIndex: this.props.indexInFolder,
    })
  }

  private onMouseLeave = () => {
    if (dragAndDropManager.isDragOfTypeInProgress(DragType.Repository)) {
      dragAndDropManager.emitLeaveDropTarget()
    }
  }

  private onExpandClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const repository = this.props.repository
    if (!(repository instanceof Repository)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    this.props.onToggleRepositoryExpanded(repository.id)
  }

  private renderLeadingAccessory = (): JSX.Element => {
    const repository = this.props.repository

    if (!this.props.hasExpand || !(repository instanceof Repository)) {
      return <span className="repository-list-item-leading-accessory-spacer" />
    }

    return (
      <button
        className={classNames('repository-list-item-leading-accessory', {
          expanded: this.props.isExpanded,
        })}
        onClick={this.onExpandClick}
        aria-label={
          this.props.isExpanded ? 'Collapse worktrees' : 'Expand worktrees'
        }
        type="button"
      >
        <Octicon
          symbol={
            this.props.isExpanded
              ? octicons.triangleDown
              : octicons.triangleRight
          }
        />
      </button>
    )
  }

  private onDragStart = () => {
    const repository = this.props.repository
    const folderId =
      this.props.repositoryFolderAssignments.get(repository.id) ?? null

    dragAndDropManager.setDragData({
      type: DragType.Repository,
      repositoryId: repository.id,
      repositoryName: repository.name,
      sourceFolderId: folderId,
    })

    this.props.onRepositoryDragStart?.(repository)
  }

  private onDragEnd = () => {
    this.props.onRepositoryDragEnd?.(this.props.repository)
  }

  private onRenderDragElement = () => {
    const repository = this.props.repository
    this.props.dispatcher.setDragElement({
      type: DragType.Repository,
      repositoryId: repository.id,
      repositoryName: repository.name,
      sourceFolderId:
        this.props.repositoryFolderAssignments.get(repository.id) ?? null,
    })
  }

  private onRemoveDragElement = () => {
    this.props.dispatcher.clearDragElement()
  }

  public render() {
    const repository = this.props.repository
    const repoItem = this.props.repoItem

    const content = (
      <div
        className="docked-repository-row"
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <RepositoryListItem
          repository={repository}
          needsDisambiguation={repoItem.needsDisambiguation}
          aheadBehind={repoItem.aheadBehind}
          changedFilesCount={repoItem.changedFilesCount}
          matches={this.props.matches}
          renderLeadingAccessory={this.renderLeadingAccessory}
        />
      </div>
    )

    const isDraggable = !(repository instanceof CloningRepository)
    return isDraggable ? (
      <Draggable
        isEnabled={true}
        onDragStart={this.onDragStart}
        onDragEnd={this.onDragEnd}
        onRenderDragElement={this.onRenderDragElement}
        onRemoveDragElement={this.onRemoveDragElement}
        dropTargetSelectors={[]}
      >
        {content}
      </Draggable>
    ) : (
      content
    )
  }
}

/** Represents either a repository or a nested worktree in the list */
interface IDockedRepositoryItem {
  readonly kind: 'repository'
  readonly id: string
  readonly text: ReadonlyArray<string>
  readonly item: IRepositoryListItem
  readonly hasWorktrees: boolean
  readonly isExpanded: boolean
  /** Folder ID for this repository row (null means ungrouped) */
  readonly folderId: number | null
  /** Index within its folder, for drag-and-drop reordering */
  readonly indexInFolder: number
}

interface IDockedWorktreeItem {
  readonly kind: 'worktree'
  readonly id: string
  readonly text: ReadonlyArray<string>
  readonly worktree: IWorktreeState
  readonly parentRepository: Repository
  readonly isCurrent: boolean
}

interface IEmptyFolderItem {
  readonly kind: 'empty-folder'
  readonly id: string
  readonly text: ReadonlyArray<string>
  readonly folderId: number | null
}

type DockedListItem =
  | IDockedRepositoryItem
  | IDockedWorktreeItem
  | IEmptyFolderItem

interface IDockedRepositoriesListProps {
  readonly dispatcher: Dispatcher
  readonly repositories: ReadonlyArray<Repositoryish>
  readonly selectedRepository: Repositoryish | null
  readonly recentRepositories: ReadonlyArray<number>
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >
  readonly groupingMode: RepositoryGroupingMode
  readonly repositoryFolders: ReadonlyArray<IRepositoryFolder>
  readonly repositoryFolderAssignments: ReadonlyMap<number, number>
  readonly repositoryOrderInFolders: ReadonlyMap<number, ReadonlyArray<number>>
  readonly expandedRepositories: ReadonlySet<number>
  readonly getWorktreesForRepository: (
    repository: Repository
  ) => IWorktreesState | null
  readonly filterText: string
  readonly onSelectionChanged: (repository: Repositoryish) => void
  readonly onFilterTextChanged: (text: string) => void
  readonly onRemoveRepository: (repository: Repositoryish) => void
  readonly onShowRepository: (repository: Repositoryish) => void
  readonly onViewOnGitHub: (repository: Repositoryish) => void
  readonly onOpenInShell: (repository: Repositoryish) => void
  readonly onOpenInExternalEditor: (repository: Repositoryish) => void
  readonly externalEditorLabel?: string
  readonly shellLabel?: string
  readonly askForConfirmationOnRemoveRepository: boolean
  readonly onToggleRepositoryExpanded: (repositoryId: number) => void
  /** Called when a repository drag starts */
  readonly onRepositoryDragStart?: (repository: Repositoryish) => void
  /** Called when a repository drag ends */
  readonly onRepositoryDragEnd?: (repository: Repositoryish) => void
}

const RowHeight = 29

/**
 * The list of repositories displayed in the docked sidebar.
 * Folder view: groups repositories by user-defined folders and supports
 * nested worktrees and drag-and-drop assignment to folders.
 */
export class DockedRepositoriesList extends React.Component<IDockedRepositoriesListProps> {
  private onEnterDropTargetDisposable: Disposable | null = null
  private onLeaveDropTargetDisposable: Disposable | null = null
  private onDragEndedDisposable: Disposable | null = null
  private currentDropTarget: DropTarget | null = null

  /**
   * Flatten the existing repository grouping to get consistent per-repo list item
   * data (text, disambiguation, indicators) without re-implementing it.
   */
  private getBaseItemsById = memoizeOne(
    (
      repositories: ReadonlyArray<Repositoryish> | null,
      localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
      recentRepositories: ReadonlyArray<number>
    ) => {
      const byId = new Map<number, IRepositoryListItem>()
      if (repositories === null) {
        return byId
      }

      const groups = groupRepositories(
        repositories,
        localRepositoryStateLookup,
        recentRepositories
      )

      for (const group of groups) {
        for (const item of group.items) {
          byId.set(item.repository.id, item)
        }
      }

      return byId
    }
  )

  /**
   * Build groups for folder view (folders + ungrouped). Supports nested worktrees.
   */
  private buildFolderGroups = memoizeOne(
    (
      repositories: ReadonlyArray<Repositoryish> | null,
      localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
      recentRepositories: ReadonlyArray<number>,
      repositoryFolders: ReadonlyArray<IRepositoryFolder>,
      repositoryFolderAssignments: ReadonlyMap<number, number>,
      expandedRepositories: ReadonlySet<number>,
      getWorktreesForRepository: (
        repository: Repository
      ) => IWorktreesState | null,
      filterText: string,
      selectedRepositoryPath: string | null
    ): ReadonlyArray<
      IFilterListGroup<DockedListItem, FolderGroupIdentifier>
    > => {
      if (repositories === null) {
        return []
      }

      const baseItemsById = this.getBaseItemsById(
        repositories,
        localRepositoryStateLookup,
        recentRepositories
      )

      const folders = [...repositoryFolders].sort((a, b) => {
        const order = a.order - b.order
        return order !== 0 ? order : a.name.localeCompare(b.name)
      })

      const itemsByFolderId = new Map<number, Array<IRepositoryListItem>>()
      const ungrouped: Array<IRepositoryListItem> = []

      for (const repo of repositories) {
        const item = baseItemsById.get(repo.id)
        if (!item) {
          continue
        }

        const folderId = repositoryFolderAssignments.get(repo.id)
        if (folderId !== undefined) {
          const existing = itemsByFolderId.get(folderId) ?? []
          existing.push(item)
          itemsByFolderId.set(folderId, existing)
        } else {
          ungrouped.push(item)
        }
      }

      const toDockedItems = (
        repoItems: ReadonlyArray<IRepositoryListItem>,
        folderId: number | null
      ): DockedListItem[] => {
        const newItems: DockedListItem[] = []

        for (const [indexInFolder, item] of repoItems.entries()) {
          const repository = item.repository

          const worktreesState =
            enableNestedWorktreesInSidebar() && repository instanceof Repository
              ? getWorktreesForRepository(repository)
              : null
          const worktrees = worktreesState?.worktrees ?? []
          const hasWorktrees = worktrees.length > 1
          const isExpanded = expandedRepositories.has(repository.id)

          newItems.push({
            kind: 'repository',
            id: `repo-${repository.id}`,
            text: item.text,
            item,
            hasWorktrees,
            isExpanded,
            folderId,
            indexInFolder,
          })

          if (
            enableNestedWorktreesInSidebar() &&
            isExpanded &&
            hasWorktrees &&
            repository instanceof Repository
          ) {
            const linkedWorktrees = worktrees.filter(wt => !wt.isMain)
            for (const wt of linkedWorktrees) {
              const worktreeName = wt.branch ?? 'Detached'
              newItems.push({
                kind: 'worktree',
                id: `worktree-${wt.path}`,
                text: [worktreeName, wt.path],
                worktree: wt,
                parentRepository: repository,
                isCurrent: wt.path === selectedRepositoryPath,
              })
            }
          }
        }

        return newItems
      }

      const groups: Array<
        IFilterListGroup<DockedListItem, FolderGroupIdentifier>
      > = []

      // Folder groups
      for (const folder of folders) {
        const repoItems = itemsByFolderId.get(folder.id) ?? []
        const ordered = this.orderItemsWithinFolder(repoItems, folder.id)

        const isFiltering = filterText.trim().length > 0
        const isCollapsed = folder.isCollapsed && !isFiltering

        const items = isCollapsed ? [] : toDockedItems(ordered, folder.id)

        // SectionFilterList skips groups that have no items, so empty folders
        // wouldn't appear at all. Add a placeholder item so the folder renders.
        if (!isCollapsed && items.length === 0) {
          items.push({
            kind: 'empty-folder',
            id: `empty-folder-${folder.id}`,
            text: [''],
            folderId: folder.id,
          })
        }

        groups.push({
          identifier: {
            kind: 'folder',
            folderId: folder.id,
            name: folder.name,
            isCollapsed: folder.isCollapsed,
          },
          items,
        })
      }

      // Ungrouped
      const orderedUngrouped = this.orderItemsWithinFolder(ungrouped, 0)
      groups.push({
        identifier: { kind: 'ungrouped' },
        items: toDockedItems(orderedUngrouped, null),
      })

      return groups
    }
  )

  private orderItemsWithinFolder = (
    items: ReadonlyArray<IRepositoryListItem>,
    folderId: number
  ) => {
    const desiredOrder = this.props.repositoryOrderInFolders.get(folderId) ?? []
    const byId = new Map(items.map(i => [i.repository.id, i] as const))

    const ordered: IRepositoryListItem[] = []
    for (const id of desiredOrder) {
      const match = byId.get(id)
      if (match) {
        ordered.push(match)
        byId.delete(id)
      }
    }

    // Preserve the stable order for any repositories not yet included
    for (const item of items) {
      if (byId.has(item.repository.id)) {
        ordered.push(item)
      }
    }

    return ordered
  }

  private getSelectedItem = (
    groups: ReadonlyArray<
      IFilterListGroup<DockedListItem, FolderGroupIdentifier>
    >,
    selectedRepository: Repositoryish | null
  ): DockedListItem | null => {
    if (selectedRepository === null) {
      return null
    }

    for (const group of groups) {
      for (const item of group.items) {
        if (
          item.kind === 'repository' &&
          item.item.repository.id === selectedRepository.id
        ) {
          return item
        }
      }
    }
    return null
  }

  private renderItem = (
    item: DockedListItem,
    matches: IMatches
  ): JSX.Element => {
    if (item.kind === 'worktree') {
      return this.renderWorktreeItem(item, matches)
    }
    if (item.kind === 'empty-folder') {
      return this.renderEmptyFolderItem()
    }
    return this.renderRepositoryItem(item, matches)
  }

  private onItemClick = (item: DockedListItem) => {
    if (item.kind === 'repository') {
      const hasIndicator =
        item.item.changedFilesCount > 0 ||
        (item.item.aheadBehind !== null
          ? item.item.aheadBehind.ahead > 0 || item.item.aheadBehind.behind > 0
          : false)
      this.props.dispatcher.recordRepoClicked(hasIndicator)
      this.props.onSelectionChanged(item.item.repository)
    } else if (item.kind === 'worktree') {
      // Switch worktrees without adding them as separate "local repositories".
      this.props.onSelectionChanged(
        createRepositoryWithPath(item.parentRepository, item.worktree.path)
      )
    } else {
      // empty-folder: no-op
    }
  }

  private stopPropagation = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault()
    event.stopPropagation()
  }

  private onFolderActionsButtonClick = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const folderIdText = event.currentTarget.dataset.folderId
    const folderName = event.currentTarget.dataset.folderName
    if (folderIdText === undefined || folderName === undefined) {
      return
    }

    const folderId = parseInt(folderIdText, 10)
    if (Number.isNaN(folderId)) {
      return
    }

    await this.showFolderContextMenu({ folderId, name: folderName })
  }

  private onFolderHeaderMouseEnter = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!dragAndDropManager.isDragOfTypeInProgress(DragType.Repository)) {
      return
    }

    const groupKind = event.currentTarget.dataset.groupKind
    if (groupKind === 'folder') {
      const folderIdText = event.currentTarget.dataset.folderId
      const folderName = event.currentTarget.dataset.folderName
      if (folderIdText === undefined || folderName === undefined) {
        return
      }

      const folderId = parseInt(folderIdText, 10)
      if (Number.isNaN(folderId)) {
        return
      }

      dragAndDropManager.emitEnterDropTarget({
        type: DropTargetType.RepositoryFolder,
        folderId,
        folderName,
      })
    } else {
      dragAndDropManager.emitEnterDropTarget({
        type: DropTargetType.RepositoryFolder,
        folderId: 0,
        folderName: 'Ungrouped',
      })
    }
  }

  private onFolderHeaderMouseLeave = () => {
    if (dragAndDropManager.isDragOfTypeInProgress(DragType.Repository)) {
      dragAndDropManager.emitLeaveDropTarget()
    }
  }

  private onFolderHeaderClick = (event: React.MouseEvent<HTMLDivElement>) => {
    this.toggleFolderCollapsed(event.currentTarget)
  }

  private onFolderHeaderKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    this.toggleFolderCollapsed(event.currentTarget)
  }

  private toggleFolderCollapsed = (target: HTMLDivElement) => {
    const groupKind = target.dataset.groupKind
    if (groupKind !== 'folder') {
      return
    }

    const folderIdText = target.dataset.folderId
    if (folderIdText === undefined) {
      return
    }

    const folderId = parseInt(folderIdText, 10)
    if (Number.isNaN(folderId)) {
      return
    }

    this.props.dispatcher.toggleRepositoryFolderCollapsed(folderId)
  }

  private onFolderHeaderContextMenu = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const groupKind = event.currentTarget.dataset.groupKind
    if (groupKind !== 'folder') {
      return
    }

    const folderIdText = event.currentTarget.dataset.folderId
    const folderName = event.currentTarget.dataset.folderName
    if (folderIdText === undefined || folderName === undefined) {
      return
    }

    const folderId = parseInt(folderIdText, 10)
    if (Number.isNaN(folderId)) {
      return
    }

    event.preventDefault()
    await this.showFolderContextMenu({ folderId, name: folderName })
  }

  public componentDidMount() {
    this.onEnterDropTargetDisposable = dragAndDropManager.onEnterDropTarget(
      target => {
        if (!dragAndDropManager.isDragOfTypeInProgress(DragType.Repository)) {
          return
        }
        this.currentDropTarget = target
      }
    )

    this.onLeaveDropTargetDisposable = dragAndDropManager.onLeaveDropTarget(
      () => {
        this.currentDropTarget = null
      }
    )

    this.onDragEndedDisposable = dragAndDropManager.onDragEnded(() => {
      this.onRepositoryDragEnded()
    })
  }

  public componentWillUnmount() {
    this.onEnterDropTargetDisposable?.dispose()
    this.onEnterDropTargetDisposable = null
    this.onLeaveDropTargetDisposable?.dispose()
    this.onLeaveDropTargetDisposable = null
    this.onDragEndedDisposable?.dispose()
    this.onDragEndedDisposable = null
  }

  private getFolderKeyForRepositoryId(repositoryId: number): number {
    return this.props.repositoryFolderAssignments.get(repositoryId) ?? 0
  }

  private getOrderedRepositoryIdsForFolder(
    folderKey: number
  ): ReadonlyArray<number> {
    const members: number[] = []
    for (const repo of this.props.repositories) {
      const key = this.getFolderKeyForRepositoryId(repo.id)
      if (key === folderKey) {
        members.push(repo.id)
      }
    }

    const desiredOrder =
      this.props.repositoryOrderInFolders.get(folderKey) ?? []
    const remaining = new Set(members)

    const ordered: number[] = []
    for (const id of desiredOrder) {
      if (remaining.has(id)) {
        ordered.push(id)
        remaining.delete(id)
      }
    }

    // Append any remaining in stable repository list order.
    for (const id of members) {
      if (remaining.has(id)) {
        ordered.push(id)
      }
    }

    return ordered
  }

  private async onRepositoryDragEnded() {
    const dragData = dragAndDropManager.dragData
    if (dragData === null || dragData.type !== DragType.Repository) {
      return
    }

    const dropTarget = this.currentDropTarget
    if (dropTarget === null) {
      return
    }

    const repositoryId = dragData.repositoryId
    const sourceFolderKey = dragData.sourceFolderId ?? 0

    if (dropTarget.type === DropTargetType.RepositoryFolder) {
      const targetFolderId =
        dropTarget.folderId === 0 ? null : dropTarget.folderId
      const targetFolderKey = targetFolderId ?? 0

      if (this.getFolderKeyForRepositoryId(repositoryId) !== targetFolderKey) {
        await this.props.dispatcher.assignRepositoryToFolder(
          repositoryId,
          targetFolderId
        )
      }

      const sourceOrder = [
        ...this.getOrderedRepositoryIdsForFolder(sourceFolderKey),
      ].filter(id => id !== repositoryId)
      const targetOrder = [
        ...this.getOrderedRepositoryIdsForFolder(targetFolderKey).filter(
          id => id !== repositoryId
        ),
        repositoryId,
      ]

      // Persist orders (also persists "ungrouped" order under key 0).
      if (sourceFolderKey !== targetFolderKey) {
        await this.props.dispatcher.reorderRepositoriesInFolder(
          sourceFolderKey,
          sourceOrder
        )
      }
      await this.props.dispatcher.reorderRepositoriesInFolder(
        targetFolderKey,
        targetOrder
      )

      this.currentDropTarget = null
      return
    }

    if (dropTarget.type === DropTargetType.RepositoryInsertionPoint) {
      const targetFolderKey = dropTarget.targetFolderId ?? 0
      const targetFolderId = dropTarget.targetFolderId

      if (this.getFolderKeyForRepositoryId(repositoryId) !== targetFolderKey) {
        await this.props.dispatcher.assignRepositoryToFolder(
          repositoryId,
          targetFolderId
        )
      }

      const sourceOrder = [
        ...this.getOrderedRepositoryIdsForFolder(sourceFolderKey),
      ]
      const targetOrder =
        sourceFolderKey === targetFolderKey
          ? sourceOrder
          : [...this.getOrderedRepositoryIdsForFolder(targetFolderKey)]

      const sourceIndexBefore =
        sourceFolderKey === targetFolderKey
          ? targetOrder.indexOf(repositoryId)
          : -1

      const removeFrom = (list: number[]) => {
        const idx = list.indexOf(repositoryId)
        if (idx >= 0) {
          list.splice(idx, 1)
        }
      }

      // Remove from source/target.
      removeFrom(sourceOrder)
      if (sourceFolderKey !== targetFolderKey) {
        removeFrom(targetOrder)
      }

      // Compute insertion index (before the hovered item).
      let insertAt = dropTarget.targetIndex
      if (
        sourceFolderKey === targetFolderKey &&
        sourceIndexBefore !== -1 &&
        sourceIndexBefore < insertAt
      ) {
        insertAt -= 1
      }
      insertAt = Math.max(0, Math.min(insertAt, targetOrder.length))

      targetOrder.splice(insertAt, 0, repositoryId)

      if (sourceFolderKey !== targetFolderKey) {
        await this.props.dispatcher.reorderRepositoriesInFolder(
          sourceFolderKey,
          sourceOrder
        )
      }
      await this.props.dispatcher.reorderRepositoriesInFolder(
        targetFolderKey,
        targetOrder
      )

      this.currentDropTarget = null
    }
  }

  private renderEmptyFolderItem = () => {
    return <div className="repository-folder-empty">Drop repositories here</div>
  }

  private renderWorktreeItem = (
    item: Extract<DockedListItem, { kind: 'worktree' }>,
    matches: IMatches
  ): JSX.Element => {
    const { worktree, isCurrent } = item
    const displayName = worktree.branch || 'Detached'
    // Use check icon for current, gitBranch otherwise (matches BranchListItem)
    const icon = isCurrent ? octicons.check : octicons.gitBranch

    return (
      <div
        className={classNames('nested-worktree-item', { current: isCurrent })}
      >
        <Octicon symbol={icon} />
        <span className="worktree-name">
          <HighlightText text={displayName} highlight={matches.title} />
        </span>
        {worktree.isLocked && (
          <Octicon symbol={octicons.lock} className="status-icon" />
        )}
      </div>
    )
  }

  private renderRepositoryItem = (
    item: Extract<DockedListItem, { kind: 'repository' }>,
    matches: IMatches
  ): JSX.Element => {
    const { item: repoItem } = item
    const repository = repoItem.repository

    const hasExpand =
      enableNestedWorktreesInSidebar() &&
      item.hasWorktrees &&
      repository instanceof Repository

    return (
      <DockedRepositoryRow
        dispatcher={this.props.dispatcher}
        repository={repository}
        repoItem={repoItem}
        matches={matches}
        hasExpand={hasExpand}
        isExpanded={item.isExpanded}
        folderId={item.folderId}
        indexInFolder={item.indexInFolder}
        repositoryFolderAssignments={this.props.repositoryFolderAssignments}
        onRepositoryDragStart={this.props.onRepositoryDragStart}
        onRepositoryDragEnd={this.props.onRepositoryDragEnd}
        onToggleRepositoryExpanded={this.props.onToggleRepositoryExpanded}
      />
    )
  }

  private getRepositoryCountForFolderId = (folderId: number) => {
    let count = 0
    for (const repo of this.props.repositories) {
      if (this.props.repositoryFolderAssignments.get(repo.id) === folderId) {
        count++
      }
    }
    return count
  }

  private showFolderContextMenu = async (identifier: {
    readonly folderId: number
    readonly name: string
  }) => {
    const folderId = identifier.folderId
    const repoCount = this.getRepositoryCountForFolderId(folderId)

    const items = [
      {
        label: 'Rename folder…',
        action: async () => {
          const next = window.prompt('Rename folder', identifier.name)
          const trimmed = next?.trim() ?? ''
          if (trimmed.length === 0 || trimmed === identifier.name) {
            return
          }
          await this.props.dispatcher.renameRepositoryFolder(folderId, trimmed)
        },
      },
      { type: 'separator' as const },
      {
        label: 'Delete folder…',
        action: async () => {
          const message =
            repoCount > 0
              ? `Delete folder "${identifier.name}"? ${repoCount} repository${
                  repoCount === 1 ? '' : 'ies'
                } will be moved to Ungrouped.`
              : `Delete folder "${identifier.name}"?`
          if (!window.confirm(message)) {
            return
          }
          await this.props.dispatcher.deleteRepositoryFolder(folderId)
        },
      },
    ]

    await showContextualMenu(items)
  }

  private renderGroupHeader = (
    identifier: FolderGroupIdentifier
  ): JSX.Element => {
    if (identifier.kind === 'ungrouped') {
      return (
        <div
          className="filter-list-group-header repository-folder-header"
          role="button"
          tabIndex={0}
          data-group-kind="ungrouped"
          onMouseEnter={this.onFolderHeaderMouseEnter}
          onMouseLeave={this.onFolderHeaderMouseLeave}
          onClick={this.onFolderHeaderClick}
          onKeyDown={this.onFolderHeaderKeyDown}
        >
          <TooltippedContent
            className="folder-header-content"
            tooltip="Ungrouped"
            onlyWhenOverflowed={true}
            tagName="div"
          >
            Ungrouped
          </TooltippedContent>
        </div>
      )
    }

    const label = identifier.name
    const icon = identifier.isCollapsed
      ? octicons.triangleRight
      : octicons.triangleDown

    return (
      <div
        className="filter-list-group-header repository-folder-header"
        role="button"
        tabIndex={0}
        data-group-kind="folder"
        data-folder-id={identifier.folderId}
        data-folder-name={label}
        onMouseEnter={this.onFolderHeaderMouseEnter}
        onMouseLeave={this.onFolderHeaderMouseLeave}
        onClick={this.onFolderHeaderClick}
        onKeyDown={this.onFolderHeaderKeyDown}
        onContextMenu={this.onFolderHeaderContextMenu}
      >
        <TooltippedContent
          className="folder-header-content"
          tooltip={label}
          onlyWhenOverflowed={true}
          tagName="div"
        >
          <Octicon symbol={icon} className="folder-expand-icon" />
          <Octicon symbol={octicons.fileDirectory} className="folder-icon" />
          <span className="folder-name">{label}</span>
        </TooltippedContent>
        <button
          type="button"
          className="folder-actions-button"
          aria-label="Folder actions"
          data-folder-id={identifier.folderId}
          data-folder-name={label}
          onMouseUp={this.stopPropagation}
          onClick={this.onFolderActionsButtonClick}
        >
          <Octicon symbol={octicons.kebabHorizontal} />
        </button>
      </div>
    )
  }

  private onItemContextMenu = (
    item: DockedListItem,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (item.kind !== 'repository') {
      return
    }

    event.preventDefault()

    const items = generateRepositoryListContextMenu({
      onRemoveRepository: this.props.onRemoveRepository,
      onShowRepository: this.props.onShowRepository,
      onOpenInShell: this.props.onOpenInShell,
      onOpenInExternalEditor: this.props.onOpenInExternalEditor,
      askForConfirmationOnRemoveRepository:
        this.props.askForConfirmationOnRemoveRepository,
      externalEditorLabel: this.props.externalEditorLabel,
      onChangeRepositoryAlias: repository =>
        this.props.dispatcher.showPopup({
          type: PopupType.ChangeRepositoryAlias,
          repository,
        }),
      onRemoveRepositoryAlias: repository =>
        this.props.dispatcher.changeRepositoryAlias(repository, null),
      onViewOnGitHub: this.props.onViewOnGitHub,
      repository: item.item.repository,
      shellLabel: this.props.shellLabel,
    })

    showContextualMenu(items)
  }

  public render() {
    const selectedPath = this.props.selectedRepository?.path ?? null

    const groups = this.buildFolderGroups(
      this.props.repositories,
      this.props.localRepositoryStateLookup,
      this.props.recentRepositories,
      this.props.repositoryFolders,
      this.props.repositoryFolderAssignments,
      this.props.expandedRepositories,
      this.props.getWorktreesForRepository,
      this.props.filterText,
      selectedPath
    )

    const selectedItem = this.getSelectedItem(
      groups,
      this.props.selectedRepository
    )

    return (
      <div className="repository-list docked-repositories-list">
        <SectionFilterList<DockedListItem, FolderGroupIdentifier>
          rowHeight={RowHeight}
          groups={groups}
          selectedItem={selectedItem}
          filterText={this.props.filterText}
          onFilterTextChanged={this.props.onFilterTextChanged}
          renderItem={this.renderItem}
          renderGroupHeader={this.renderGroupHeader}
          includeEmptyGroups={this.props.filterText.trim().length === 0}
          onItemClick={this.onItemClick}
          placeholderText="Filter repositories"
          onItemContextMenu={this.onItemContextMenu}
          invalidationProps={{
            repositories: this.props.repositories,
            filterText: this.props.filterText,
            expandedRepositories: this.props.expandedRepositories,
            groupingMode: this.props.groupingMode,
          }}
        />
      </div>
    )
  }
}
