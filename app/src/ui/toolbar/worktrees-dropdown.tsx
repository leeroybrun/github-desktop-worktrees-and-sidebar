import * as React from 'react'
import { Dispatcher } from '../dispatcher'
import * as octicons from '../octicons/octicons.generated'
import { OcticonSymbol, syncClockwise } from '../octicons'
import { Repository } from '../../models/repository'
import { Resizable } from '../resizable'
import { ToolbarDropdown, DropdownState } from './dropdown'
import { IConstrainedValue, IWorktreesState } from '../../lib/app-state'
import { WorktreesContainer } from '../worktrees/worktrees-container'
import { enableResizingToolbarButtons } from '../../lib/feature-flag'

interface IWorktreesDropdownProps {
  readonly dispatcher: Dispatcher

  /** The currently selected repository. */
  readonly repository: Repository

  /** The worktrees state for the current repository */
  readonly worktreesState: IWorktreesState

  /** The width of the resizable worktrees dropdown button */
  readonly worktreesDropdownWidth: IConstrainedValue

  /** Whether or not the worktrees dropdown is currently open */
  readonly isOpen: boolean

  /**
   * An event handler for when the drop down is opened, or closed, by a pointer
   * event or by pressing the space or enter key while focused.
   *
   * @param state    - The new state of the drop down
   */
  readonly onDropDownStateChanged: (state: DropdownState) => void

  /** Whether the dropdown will trap focus or not. Defaults to true. */
  readonly enableFocusTrap: boolean
}

/**
 * A drop down for selecting and managing worktrees.
 */
export class WorktreesDropdown extends React.Component<IWorktreesDropdownProps> {
  private renderWorktreesFoldout = (): JSX.Element | null => {
    return (
      <WorktreesContainer
        dispatcher={this.props.dispatcher}
        repository={this.props.repository}
        worktreesState={this.props.worktreesState}
      />
    )
  }

  private onDropDownStateChanged = (state: DropdownState) => {
    // Refresh worktrees when the dropdown is opened
    if (state === 'open') {
      this.props.dispatcher.refreshWorktrees(this.props.repository)
    }
    this.props.onDropDownStateChanged(state)
  }

  public render() {
    const { worktreesState, enableFocusTrap } = this.props
    const { worktrees, currentWorktree, isLoadingWorktrees } = worktreesState

    let icon: OcticonSymbol = octicons.fileDirectorySymlink
    let iconClassName: string | undefined = undefined
    let title: string
    let description = __DARWIN__ ? 'Worktrees' : 'Worktrees'
    let tooltip: string

    if (isLoadingWorktrees) {
      title = 'Loading...'
      tooltip = 'Loading worktrees...'
      icon = syncClockwise
      iconClassName = 'spin'
    } else if (currentWorktree) {
      if (currentWorktree.isMain) {
        title = 'Main'
        tooltip = `Main worktree at ${currentWorktree.path}`
      } else {
        title = currentWorktree.branch || 'Detached'
        tooltip = `Worktree at ${currentWorktree.path}`
      }
      description = `${worktrees.length} worktree${worktrees.length !== 1 ? 's' : ''}`
    } else {
      title = 'No worktree'
      tooltip = 'No current worktree'
    }

    const isOpen = this.props.isOpen
    const currentState: DropdownState = isOpen ? 'open' : 'closed'

    if (!enableResizingToolbarButtons()) {
      return (
        <ToolbarDropdown
          className="worktrees-button"
          icon={icon}
          iconClassName={iconClassName}
          title={title}
          description={description}
          tooltip={isOpen ? undefined : tooltip}
          onDropdownStateChanged={this.onDropDownStateChanged}
          dropdownContentRenderer={this.renderWorktreesFoldout}
          dropdownState={currentState}
          showDisclosureArrow={true}
          onlyShowTooltipWhenOverflowed={true}
          enableFocusTrap={enableFocusTrap}
        />
      )
    }

    // Properties to override the default foldout style for the worktrees dropdown.
    // Match BranchDropdown foldout sizing so the worktrees UI feels native.
    const foldoutStyleOverrides: React.CSSProperties = {
      width: this.props.worktreesDropdownWidth.value,
      maxWidth: this.props.worktreesDropdownWidth.max,
      minWidth: 365,
    }

    return (
      <Resizable
        width={this.props.worktreesDropdownWidth.value}
        onReset={this.onReset}
        onResize={this.onResize}
        maximumWidth={this.props.worktreesDropdownWidth.max}
        minimumWidth={this.props.worktreesDropdownWidth.min}
        description="Worktrees dropdown button"
      >
        <ToolbarDropdown
          className="worktrees-button"
          icon={icon}
          iconClassName={iconClassName}
          title={title}
          description={description}
          foldoutStyleOverrides={foldoutStyleOverrides}
          tooltip={isOpen ? undefined : tooltip}
          onDropdownStateChanged={this.onDropDownStateChanged}
          dropdownContentRenderer={this.renderWorktreesFoldout}
          dropdownState={currentState}
          showDisclosureArrow={true}
          onlyShowTooltipWhenOverflowed={true}
          enableFocusTrap={enableFocusTrap}
        />
      </Resizable>
    )
  }

  private onResize = (width: number) => {
    this.props.dispatcher.setWorktreesDropdownWidth(width)
  }

  private onReset = () => {
    this.props.dispatcher.resetWorktreesDropdownWidth()
  }
}
