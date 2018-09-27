import { TreeDataProvider, Event, TreeItem, TextDocument, workspace, Uri } from "vscode";
import EntryAnchor from "./entryAnchor";
import EntryError from "./entryError";
import { AnchorEngine } from "./anchorEngine";
import EntryCachedFile from "./entryCachedFile";
import EntryScan from "./entryScan";

/**
 * The type repsenting any Entry
 */
type AnyEntry = EntryAnchor|EntryError|EntryCachedFile|EntryScan;
type AnyEntryArray = EntryAnchor[]|EntryError[]|EntryCachedFile[]|EntryScan[];

/**
 * AnchorProvider implementation in charge of returning the anchors in the current workspace
 */
export class WorkspaceAnchorProvider implements TreeDataProvider<AnyEntry> {

	readonly provider: AnchorEngine;
	readonly onDidChangeTreeData: Event<undefined>;

	constructor(provider: AnchorEngine) {
		this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
		this.provider = provider;
	}

	getTreeItem(element: AnyEntry): TreeItem {
		return element;
	}

	getChildren(element?: AnyEntry): Thenable<AnyEntryArray> {
		return new Promise((success) => {
			if(element) {
				if(element instanceof EntryCachedFile) {
					let res: EntryAnchor[] = [];
	
					const cachedFile = (element as EntryCachedFile);
					
					cachedFile.anchors.forEach((anchor: EntryAnchor) => {
						if(!anchor.isVisibleInWorkspace) return;

						res.push(new EntryAnchor(
							anchor.anchorTag,
							anchor.anchorText,
							anchor.startIndex,
							anchor.endIndex,
							anchor.lineNumber,
							anchor.icon,
							anchor.scope,
							cachedFile.file
						));
					});
	
					success(EntryAnchor.sortAnchors(res));
				} else {
					success([]);
				}
				
				return;
			}

			if(!this.provider._config!.workspace.enabled) {
				success([this.provider.errorWorkspaceDisabled]);
				return;
			} else if(!workspace.workspaceFolders) {
				success([this.provider.errorFileOnly]);
				return;
			} else if(this.provider._config!.workspace.lazyLoad && !this.provider.anchorsScanned) {
				success([this.provider.statusScan])
			} else if(!this.provider.anchorsLoaded) {
				success([this.provider.statusLoading]);
				return;
			}

			let res: EntryCachedFile[] = [];

			this.provider.anchorMaps.forEach((anchors: EntryAnchor[], document: Uri) => {
				if(anchors.length == 0) return; // Skip empty files

				let notVisible = true;

				anchors.forEach(anchor => {
					if(anchor.isVisibleInWorkspace) notVisible = false;
				});
				
				if(!notVisible) {
					try {
						res.push(new EntryCachedFile(document, anchors));
					} catch(err) {
						// Simply ignore, we do not want to push this file
					}
				}
			});

			if(res.length == 0) {
				success([this.provider.errorEmptyWorkspace]);
				return;
			}

			success(res.sort((left, right) => {
				return left.label!.localeCompare(right.label!)
			}));
		});
	}

}