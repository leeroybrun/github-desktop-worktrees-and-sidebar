import * as React from 'react'

import { Repository, ILocalRepositoryState } from '../../models/repository'
import { CloningRepository } from '../../models/cloning-repository'
import { Dispatcher } from '../dispatcher'
import { IRepositoryFolder, IWorktreesState } from '../../lib/app-state'
import { DockedRepositoriesList } from './docked-repositories-list'
import { RepositoriesList } from './repositories-list'

type Repositoryish = Repository | CloningRepository

interface IRepositoryListViewCommonProps {
  readonly dispatcher: Dispatcher
  readonly repositories: ReadonlyArray<Repositoryish>
  readonly selectedRepository: Repositoryish | null
  readonly recentRepositories: ReadonlyArray<number>
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >
  readonly filterText: string
  readonly onFilterTextChanged: (text: string) => void
  readonly onSelectionChanged: (repository: Repositoryish) => void
  readonly onRemoveRepository: (repository: Repositoryish) => void
  readonly onShowRepository: (repository: Repositoryish) => void
  readonly onViewOnGitHub: (repository: Repositoryish) => void
  readonly onOpenInShell: (repository: Repositoryish) => void
  readonly onOpenInExternalEditor: (repository: Repositoryish) => void
  readonly externalEditorLabel?: string
  readonly shellLabel?: string
  readonly askForConfirmationOnRemoveRepository: boolean
}

interface IRepositoryListViewOwnerProps extends IRepositoryListViewCommonProps {
  readonly groupingMode: 'owner'
}

interface IRepositoryListViewFolderProps
  extends IRepositoryListViewCommonProps {
  readonly groupingMode: 'folder'
  readonly repositoryFolders: ReadonlyArray<IRepositoryFolder>
  readonly repositoryFolderAssignments: ReadonlyMap<number, number>
  readonly repositoryOrderInFolders: ReadonlyMap<number, ReadonlyArray<number>>
  readonly expandedRepositories: ReadonlySet<number>
  readonly onToggleRepositoryExpanded: (repositoryId: number) => void
  readonly getWorktreesForRepository: (
    repository: Repository
  ) => IWorktreesState | null
}

export type RepositoryListViewProps =
  | IRepositoryListViewOwnerProps
  | IRepositoryListViewFolderProps

/**
 * Shared list component used by both the repository dropdown and the docked
 * sidebar. This guarantees both surfaces use the exact same renderer; it
 * delegates to the existing specialized implementations based on grouping mode.
 *
 * Next step (optional): progressively move folder + owner implementations into
 * a single core renderer and retire the two wrappers.
 */
export const RepositoryListView: React.FC<RepositoryListViewProps> = props => {
  if (props.groupingMode === 'folder') {
    return (
      <DockedRepositoriesList
        dispatcher={props.dispatcher}
        repositories={props.repositories}
        selectedRepository={props.selectedRepository}
        recentRepositories={props.recentRepositories}
        localRepositoryStateLookup={props.localRepositoryStateLookup}
        groupingMode={props.groupingMode}
        repositoryFolders={props.repositoryFolders}
        repositoryFolderAssignments={props.repositoryFolderAssignments}
        repositoryOrderInFolders={props.repositoryOrderInFolders}
        expandedRepositories={props.expandedRepositories}
        getWorktreesForRepository={props.getWorktreesForRepository}
        filterText={props.filterText}
        onSelectionChanged={props.onSelectionChanged}
        onFilterTextChanged={props.onFilterTextChanged}
        onRemoveRepository={props.onRemoveRepository}
        onShowRepository={props.onShowRepository}
        onViewOnGitHub={props.onViewOnGitHub}
        onOpenInShell={props.onOpenInShell}
        onOpenInExternalEditor={props.onOpenInExternalEditor}
        externalEditorLabel={props.externalEditorLabel}
        shellLabel={props.shellLabel}
        askForConfirmationOnRemoveRepository={
          props.askForConfirmationOnRemoveRepository
        }
        onToggleRepositoryExpanded={props.onToggleRepositoryExpanded}
      />
    )
  }

  return (
    <RepositoriesList
      filterText={props.filterText}
      onFilterTextChanged={props.onFilterTextChanged}
      selectedRepository={props.selectedRepository}
      onSelectionChanged={props.onSelectionChanged}
      repositories={props.repositories}
      recentRepositories={props.recentRepositories}
      localRepositoryStateLookup={props.localRepositoryStateLookup}
      askForConfirmationOnRemoveRepository={
        props.askForConfirmationOnRemoveRepository
      }
      onRemoveRepository={props.onRemoveRepository}
      onViewOnGitHub={props.onViewOnGitHub}
      onOpenInShell={props.onOpenInShell}
      onShowRepository={props.onShowRepository}
      onOpenInExternalEditor={props.onOpenInExternalEditor}
      externalEditorLabel={props.externalEditorLabel}
      shellLabel={props.shellLabel}
      dispatcher={props.dispatcher}
    />
  )
}
