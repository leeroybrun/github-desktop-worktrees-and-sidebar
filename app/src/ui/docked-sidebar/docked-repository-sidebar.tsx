import * as React from 'react'
import { Resizable } from '../resizable'
import { Dispatcher } from '../dispatcher'
import {
  IConstrainedValue,
  IRepositoryFolder,
  RepositoryGroupingMode,
  IWorktreesState,
} from '../../lib/app-state'
import { Repository, ILocalRepositoryState } from '../../models/repository'
import { CloningRepository } from '../../models/cloning-repository'
import { DockedRepositoriesList } from './docked-repositories-list'
import { RepositoriesList } from '../repositories-list'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import classNames from 'classnames'
import { enableCustomRepositoryFolders } from '../../lib/feature-flag'

type Repositoryish = Repository | CloningRepository

interface IDockedRepositorySidebarProps {
  readonly dispatcher: Dispatcher

  /** The list of all repositories */
  readonly repositories: ReadonlyArray<Repositoryish>

  /** The currently selected repository */
  readonly selectedRepository: Repositoryish | null

  /** Recent repositories */
  readonly recentRepositories: ReadonlyArray<number>

  /** A cache of the latest repository state values, keyed by the repository id */
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >

  /** The width of the docked sidebar */
  readonly width: IConstrainedValue

  /** The grouping mode for repositories */
  readonly groupingMode: RepositoryGroupingMode

  /** User-defined repository folders */
  readonly repositoryFolders: ReadonlyArray<IRepositoryFolder>

  /** Mapping of repository IDs to folder IDs */
  readonly repositoryFolderAssignments: ReadonlyMap<number, number>

  /** The order of repositories within folders */
  readonly repositoryOrderInFolders: ReadonlyMap<number, ReadonlyArray<number>>

  /** Set of expanded repository IDs (for showing worktrees) */
  readonly expandedRepositories: ReadonlySet<number>

  /** Function to get worktrees for a repository */
  readonly getWorktreesForRepository: (
    repository: Repository
  ) => IWorktreesState | null

  /** The current filter text */
  readonly filterText: string

  /** Called when repository selection changes */
  readonly onSelectionChanged: (repository: Repositoryish) => void

  /** Called when the filter text changes */
  readonly onFilterTextChanged: (text: string) => void

  /** Called when a repository should be removed */
  readonly onRemoveRepository: (repository: Repositoryish) => void

  /** Called when a repository should be shown in file explorer */
  readonly onShowRepository: (repository: Repositoryish) => void

  /** Called when viewing repository on GitHub */
  readonly onViewOnGitHub: (repository: Repositoryish) => void

  /** Called when opening repository in shell */
  readonly onOpenInShell: (repository: Repositoryish) => void

  /** Called when opening repository in external editor */
  readonly onOpenInExternalEditor: (repository: Repositoryish) => void

  /** The label for the external editor */
  readonly externalEditorLabel?: string

  /** The label for the shell */
  readonly shellLabel?: string

  /** Whether to ask for confirmation when removing a repository */
  readonly askForConfirmationOnRemoveRepository: boolean

  /** Called to close/hide the docked sidebar */
  readonly onHideSidebar: () => void
}

interface IDockedRepositorySidebarState {
  readonly isCreatingFolder: boolean
  readonly newFolderName: string
}

/**
 * A docked sidebar that displays the repository list persistently.
 * This sidebar stays visible alongside the main content instead of
 * being a temporary foldout overlay.
 */
export class DockedRepositorySidebar extends React.Component<
  IDockedRepositorySidebarProps,
  IDockedRepositorySidebarState
> {
  public constructor(props: IDockedRepositorySidebarProps) {
    super(props)
    this.state = { isCreatingFolder: false, newFolderName: '' }
  }

  private onResize = (width: number) => {
    this.props.dispatcher.setDockedRepositorySidebarWidth(width)
  }

  private onReset = () => {
    this.props.dispatcher.resetDockedRepositorySidebarWidth()
  }

  private onToggleGroupingMode = () => {
    const newMode =
      this.props.groupingMode === 'owner' ? 'folder' : 'owner'
    this.props.dispatcher.setRepositoryGroupingMode(newMode)
  }

  private onStartCreateFolder = () => {
    this.setState({ isCreatingFolder: true, newFolderName: '' })
  }

  private onCancelCreateFolder = () => {
    this.setState({ isCreatingFolder: false, newFolderName: '' })
  }

  private onNewFolderNameChanged = (newFolderName: string) => {
    this.setState({ newFolderName })
  }

  private onSubmitCreateFolder = async () => {
    const name = this.state.newFolderName.trim()
    if (name.length === 0) {
      return
    }

    await this.props.dispatcher.createRepositoryFolder(name)
    this.setState({ isCreatingFolder: false, newFolderName: '' })
  }

  private onToggleRepositoryExpanded = (repositoryId: number) => {
    this.props.dispatcher.toggleRepositoryExpanded(repositoryId)
  }

  public render() {
    const className = classNames('docked-repository-sidebar')

    return (
      <Resizable
        id="docked-repository-sidebar"
        width={this.props.width.value}
        minimumWidth={this.props.width.min}
        maximumWidth={this.props.width.max}
        onResize={this.onResize}
        onReset={this.onReset}
        description="Repository sidebar"
      >
        <div className={className}>
          <div className="docked-sidebar-header">
            {this.state.isCreatingFolder ? (
              <div className="docked-sidebar-create-folder">
                <TextBox
                  value={this.state.newFolderName}
                  onValueChanged={this.onNewFolderNameChanged}
                  placeholder={__DARWIN__ ? 'New Folder Name' : 'New folder name'}
                  autoFocus={true}
                  onEnterPressed={this.onSubmitCreateFolder}
                  ariaLabel={__DARWIN__ ? 'New Folder Name' : 'New folder name'}
                />
                <Button
                  className="confirm-create-folder-button"
                  onClick={this.onSubmitCreateFolder}
                  tooltip={__DARWIN__ ? 'Create Folder' : 'Create folder'}
                >
                  <Octicon symbol={octicons.check} />
                </Button>
                <Button
                  className="cancel-create-folder-button"
                  onClick={this.onCancelCreateFolder}
                  tooltip={__DARWIN__ ? 'Cancel' : 'Cancel'}
                >
                  <Octicon symbol={octicons.x} />
                </Button>
              </div>
            ) : (
              <span className="docked-sidebar-title">Repositories</span>
            )}
            <div className="docked-sidebar-actions">
              {enableCustomRepositoryFolders() &&
                this.props.groupingMode === 'folder' &&
                !this.state.isCreatingFolder && (
                  <Button
                    className="create-folder-button"
                    onClick={this.onStartCreateFolder}
                    tooltip="Create new folder"
                  >
                    <Octicon symbol={octicons.plusCircle} />
                  </Button>
                )}
              {enableCustomRepositoryFolders() && !this.state.isCreatingFolder && (
                <Button
                  className="grouping-toggle-button"
                  onClick={this.onToggleGroupingMode}
                  tooltip={
                    this.props.groupingMode === 'owner'
                      ? 'Switch to folder view'
                      : 'Switch to owner view'
                  }
                >
                  <Octicon
                    symbol={
                      this.props.groupingMode === 'owner'
                        ? octicons.fileDirectory
                        : octicons.person
                    }
                  />
                </Button>
              )}
              <Button
                className="hide-sidebar-button"
                onClick={this.props.onHideSidebar}
                tooltip="Hide sidebar"
              >
                <Octicon symbol={octicons.x} />
              </Button>
            </div>
          </div>
          <div className="docked-repositories-list">
            {enableCustomRepositoryFolders() &&
            this.props.groupingMode === 'folder' ? (
              <DockedRepositoriesList
                dispatcher={this.props.dispatcher}
                repositories={this.props.repositories}
                selectedRepository={this.props.selectedRepository}
                recentRepositories={this.props.recentRepositories}
                localRepositoryStateLookup={this.props.localRepositoryStateLookup}
                groupingMode={this.props.groupingMode}
                repositoryFolders={this.props.repositoryFolders}
                repositoryFolderAssignments={
                  this.props.repositoryFolderAssignments
                }
                repositoryOrderInFolders={this.props.repositoryOrderInFolders}
                expandedRepositories={this.props.expandedRepositories}
                getWorktreesForRepository={this.props.getWorktreesForRepository}
                filterText={this.props.filterText}
                onSelectionChanged={this.props.onSelectionChanged}
                onFilterTextChanged={this.props.onFilterTextChanged}
                onRemoveRepository={this.props.onRemoveRepository}
                onShowRepository={this.props.onShowRepository}
                onViewOnGitHub={this.props.onViewOnGitHub}
                onOpenInShell={this.props.onOpenInShell}
                onOpenInExternalEditor={this.props.onOpenInExternalEditor}
                externalEditorLabel={this.props.externalEditorLabel}
                shellLabel={this.props.shellLabel}
                askForConfirmationOnRemoveRepository={
                  this.props.askForConfirmationOnRemoveRepository
                }
                onToggleRepositoryExpanded={this.onToggleRepositoryExpanded}
              />
            ) : (
              <RepositoriesList
                filterText={this.props.filterText}
                onFilterTextChanged={this.props.onFilterTextChanged}
                selectedRepository={this.props.selectedRepository}
                onSelectionChanged={this.props.onSelectionChanged}
                repositories={this.props.repositories}
                recentRepositories={this.props.recentRepositories}
                localRepositoryStateLookup={this.props.localRepositoryStateLookup}
                askForConfirmationOnRemoveRepository={
                  this.props.askForConfirmationOnRemoveRepository
                }
                onRemoveRepository={this.props.onRemoveRepository}
                onViewOnGitHub={this.props.onViewOnGitHub}
                onOpenInShell={this.props.onOpenInShell}
                onShowRepository={this.props.onShowRepository}
                onOpenInExternalEditor={this.props.onOpenInExternalEditor}
                externalEditorLabel={this.props.externalEditorLabel}
                shellLabel={this.props.shellLabel}
                dispatcher={this.props.dispatcher}
              />
            )}
          </div>
        </div>
      </Resizable>
    )
  }
}
