import * as React from 'react'
import classNames from 'classnames'
import memoizeOne from 'memoize-one'

import { Dispatcher } from '../dispatcher'
import { Repository, createRepositoryWithPath } from '../../models/repository'
import {
  FoldoutType,
  IWorktreeState,
  IWorktreesState,
} from '../../lib/app-state'
import { IMatches } from '../../lib/fuzzy-find'
import { IFilterListGroup } from '../lib/filter-list'
import { SectionFilterList } from '../lib/section-filter-list'
import { enableResizingToolbarButtons } from '../../lib/feature-flag'

import { WorktreeListItem } from './worktree-list-item'

interface IWorktreesContainerProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly worktreesState: IWorktreesState
}

interface IWorktreesContainerState {
  readonly filterText: string
}

interface IWorktreeListItem {
  readonly id: string
  readonly text: ReadonlyArray<string>
  readonly worktree: IWorktreeState
}

/**
 * Container component for the worktrees foldout.
 *
 * NOTE: This intentionally reuses the same structural classes as the branches
 * dropdown (`branches-container`, `branches-container-panel`, `branches-list`,
 * `branches-list-item`) in order to get pixel-consistent UI styling.
 */
export class WorktreesContainer extends React.Component<
  IWorktreesContainerProps,
  IWorktreesContainerState
> {
  private getGroups = memoizeOne((worktrees: ReadonlyArray<IWorktreeState>) => {
    const mainWorktree = worktrees.find(wt => wt.isMain) ?? null
    const linkedWorktrees = worktrees.filter(wt => !wt.isMain)

    const groups: Array<IFilterListGroup<IWorktreeListItem>> = []

    if (mainWorktree !== null) {
      groups.push({
        identifier: 'main',
        items: [
          {
            id: mainWorktree.path,
            text: [mainWorktree.branch ?? 'Main'],
            worktree: mainWorktree,
          },
        ],
      })
    }

    if (linkedWorktrees.length > 0) {
      groups.push({
        identifier: 'linked',
        items: linkedWorktrees.map(wt => ({
          id: wt.path,
          text: [wt.branch ?? 'Detached'],
          worktree: wt,
        })),
      })
    }

    return groups
  })

  public constructor(props: IWorktreesContainerProps) {
    super(props)
    this.state = {
      filterText: '',
    }
  }

  private onFilterTextChanged = (filterText: string) => {
    this.setState({ filterText })
  }

  private onItemClick = (item: IWorktreeListItem) => {
    this.props.dispatcher.closeFoldout(FoldoutType.Worktrees)
    // Switch worktrees without adding them as separate "local repositories".
    this.props.dispatcher.selectRepository(
      createRepositoryWithPath(this.props.repository, item.worktree.path)
    )
  }

  private renderItem = (item: IWorktreeListItem, matches: IMatches) => {
    const isCurrent =
      this.props.worktreesState.currentWorktree?.path === item.worktree.path

    return (
      <WorktreeListItem
        name={
          item.worktree.branch ?? (item.worktree.isMain ? 'Main' : 'Detached')
        }
        isCurrentWorktree={isCurrent}
        matches={matches}
        tooltip={item.worktree.path}
      />
    )
  }

  private renderGroupHeader = (identifier: string): JSX.Element | null => {
    if (identifier === 'main') {
      return (
        <div className="branches-list-content filter-list-group-header">
          Main Worktree
        </div>
      )
    }

    if (identifier === 'linked') {
      return (
        <div className="branches-list-content filter-list-group-header">
          Linked Worktrees
        </div>
      )
    }

    return null
  }

  private renderNoItems = () => {
    const { isLoadingWorktrees } = this.props.worktreesState
    return (
      <div className="no-items no-results-found">
        <div className="title">
          {isLoadingWorktrees ? 'Loading worktrees…' : 'No worktrees found'}
        </div>
      </div>
    )
  }

  public render() {
    const classes = classNames('branches-container', {
      resizable: enableResizingToolbarButtons(),
    })

    const { isLoadingWorktrees, worktrees, currentWorktree } =
      this.props.worktreesState

    const groups = this.getGroups(worktrees)
    const selectedItem =
      groups
        .flatMap(g => g.items)
        .find(i => i.worktree.path === currentWorktree?.path) ?? null

    return (
      <div className={classes}>
        <div className="branches-container-panel">
          <SectionFilterList<IWorktreeListItem>
            className="branches-list"
            rowHeight={30}
            groups={groups}
            selectedItem={selectedItem}
            filterText={this.state.filterText}
            onFilterTextChanged={this.onFilterTextChanged}
            renderItem={this.renderItem}
            renderGroupHeader={this.renderGroupHeader}
            onItemClick={this.onItemClick}
            invalidationProps={{
              worktrees,
              filterText: this.state.filterText,
              isLoadingWorktrees,
            }}
            // Important: keep at least one focusable element in the foldout
            // (the filter textbox) so FocusTrap doesn't crash when worktrees are
            // empty/loading.
            disabled={false}
            renderNoItems={this.renderNoItems}
          />
        </div>
      </div>
    )
  }
}
