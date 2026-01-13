import classNames from 'classnames'
import { Disposable } from 'event-kit'
import * as React from 'react'
import { dragAndDropManager } from '../../lib/drag-and-drop-manager'
import { DragType, DropTarget, DropTargetType } from '../../models/drag-drop'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IRepositoryDragElementProps {
  readonly repositoryId: number
  readonly repositoryName: string
  readonly sourceFolderId: number | null
}

interface IRepositoryDragElementState {
  readonly showTooltip: boolean
  readonly currentDropTarget: DropTarget | null
}

/**
 * A drag element that represents a repository being dragged
 * for reordering or moving to a different folder.
 */
export class RepositoryDragElement extends React.Component<
  IRepositoryDragElementProps,
  IRepositoryDragElementState
> {
  private timeoutId: number | null = null
  private onEnterDropTarget: Disposable | null = null
  private onLeaveDropTargetDisposable: Disposable | null = null

  public constructor(props: IRepositoryDragElementProps) {
    super(props)
    this.state = {
      showTooltip: false,
      currentDropTarget: null,
    }
  }

  private clearTimeout() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
    }
  }

  private setToolTipTimer(time: number) {
    if (__DARWIN__) {
      this.setState({ showTooltip: false })
      this.clearTimeout()
      this.timeoutId = window.setTimeout(
        () => this.setState({ showTooltip: true }),
        time
      )
    } else {
      this.setState({ showTooltip: true })
    }
  }

  private renderDragToolTip() {
    const { showTooltip, currentDropTarget } = this.state
    if (!showTooltip || currentDropTarget === null) {
      return null
    }

    let toolTipContents: React.ReactNode = null
    switch (currentDropTarget.type) {
      case DropTargetType.RepositoryFolder:
        toolTipContents = (
          <span>
            <span className="move-to">Move to</span>
            <span className="folder-name">{currentDropTarget.folderName}</span>
          </span>
        )
        break
      case DropTargetType.RepositoryInsertionPoint:
        toolTipContents = <span>Reorder repository</span>
        break
      default:
        return null
    }

    return <div className="tool-tip">{toolTipContents}</div>
  }

  public componentDidMount() {
    this.onEnterDropTarget = dragAndDropManager.onEnterDropTarget(
      dropTarget => {
        if (!dragAndDropManager.isDragOfTypeInProgress(DragType.Repository)) {
          return
        }

        if (
          dropTarget.type === DropTargetType.RepositoryFolder ||
          dropTarget.type === DropTargetType.RepositoryInsertionPoint
        ) {
          this.setState({ currentDropTarget: dropTarget })
          this.setToolTipTimer(1500)
        }
      }
    )

    this.onLeaveDropTargetDisposable = dragAndDropManager.onLeaveDropTarget(
      () => {
        this.clearTimeout()
        this.setState({ currentDropTarget: null, showTooltip: false })
      }
    )
  }

  public componentWillUnmount() {
    this.onEnterDropTarget?.dispose()
    this.onLeaveDropTargetDisposable?.dispose()
    this.clearTimeout()
  }

  public render() {
    const className = classNames('repository-drag-element', {
      'has-tooltip':
        this.state.showTooltip && this.state.currentDropTarget !== null,
    })

    return (
      <div
        id="repository-drag-element"
        className={className}
        data-repository-id={this.props.repositoryId}
        data-source-folder-id={this.props.sourceFolderId ?? undefined}
      >
        <div className="repository-drag-content">
          <Octicon symbol={octicons.repo} />
          <span className="repository-name">{this.props.repositoryName}</span>
        </div>
        {this.renderDragToolTip()}
      </div>
    )
  }
}
