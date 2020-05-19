import { TreeDataProvider, Event, TreeItem } from "vscode";
import EntryAnchor from "../anchor/entryAnchor";
import { AnchorEngine, FileEntry, FileEntryArray } from "../anchorEngine";

/**
 * AnchorProvider implementation in charge of returning the anchors in the current file
 */
export class FileAnchorProvider implements TreeDataProvider<FileEntry> {

	readonly provider: AnchorEngine;
	readonly onDidChangeTreeData: Event<undefined>;

	constructor(provider: AnchorEngine) {
		this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
		this.provider = provider;
	}

	getTreeItem(element: FileEntry): TreeItem {
		return element;
	}

	getChildren(element?: FileEntry): Thenable<FileEntryArray> {
		if(element) {
			if(element instanceof EntryAnchor && element.children) {
				return Promise.resolve(element.children);
			}

			return Promise.resolve([]);
		}

		// Return result
		return new Promise(resolve => {
			if(!this.provider.anchorsLoaded) {
				resolve([this.provider.statusLoading]);
			} else if(this.provider._editor == undefined) {
				resolve([this.provider.errorUnusableItem]);
			} else if(this.provider.currentAnchors.length == 0) {
				resolve([this.provider.errorEmptyItem]);
			} else {
				resolve(EntryAnchor.sortAnchors(this.provider.currentAnchors));
			}
		});
	}

}