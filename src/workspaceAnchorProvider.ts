import { TreeDataProvider, Event, TreeItem, TextDocument, workspace, Uri } from "vscode";
import EntryAnchor from "./entryAnchor";
import EntryError from "./entryError";
import { AnchorEngine } from "./anchorEngine";
import EntryCachedFile from "./entryCachedFile";

/**
 * The type repsenting any Entry
 */
type AnyEntry = EntryAnchor|EntryError|EntryCachedFile;
type AnyEntryArray = EntryAnchor[]|EntryError[]|EntryCachedFile[];

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
							anchor.decorator,
							anchor.icon,
							anchor.scope,
							cachedFile.file
						));
					});
	
					success(res);
				} else {
					success([]);
				}
				
				return;
			}

			if(!this.provider.anchorsLoaded) {
				success([this.provider.loading]);
				return;
			}

			let res: EntryCachedFile[] = [];

			this.provider.anchorMaps.forEach((anchors: EntryAnchor[], document: TextDocument) => {
				if(anchors.length == 0) return; // Skip empty files

				let notVisible = true;

				anchors.forEach(anchor => {
					if(anchor.isVisibleInWorkspace) notVisible = false;
				});
				
				if(!notVisible) {
					res.push(new EntryCachedFile(workspace.rootPath!, document.uri, anchors));
				}
			});

			if(res.length == 0) {
				success([this.provider.emptyWorkspace]);
				return;
			}

			success(res);
		});
	}

}