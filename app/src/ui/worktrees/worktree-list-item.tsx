import * as React from 'react'
import { IMatches } from '../../lib/fuzzy-find'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { HighlightText } from '../lib/highlight-text'
import classNames from 'classnames'
import { TooltippedContent } from '../lib/tooltipped-content'
import { enableAccessibleListToolTips } from '../../lib/feature-flag'

interface IWorktreeListItemProps {
  /** Display name for the worktree (usually branch name) */
  readonly name: string
  /** Full path for tooltip context */
  readonly tooltip: string
  readonly matches: IMatches
  readonly isCurrentWorktree: boolean
}

/**
 * Renders a single worktree item in the worktrees list.
 * Intentionally reuses the same classes/structure as BranchListItem so it
 * inherits the exact same styling and accessibility behavior.
 */
export class WorktreeListItem extends React.Component<IWorktreeListItemProps> {
  public render() {
    const { name, matches, isCurrentWorktree } = this.props

    const className = classNames('branches-list-item')

    // Use check icon for current worktree, gitBranch otherwise (matches BranchListItem)
    const icon = isCurrentWorktree ? octicons.check : octicons.gitBranch

    return (
      <div className={className}>
        <Octicon className="icon" symbol={icon} />
        <TooltippedContent
          className="name"
          tooltip={this.props.tooltip}
          onlyWhenOverflowed={true}
          tagName="div"
          disabled={enableAccessibleListToolTips()}
        >
          <HighlightText text={name} highlight={matches.title} />
        </TooltippedContent>
      </div>
    )
  }
}
