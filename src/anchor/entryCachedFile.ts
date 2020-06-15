import { TreeItem, TreeItemCollapsibleState, Uri, workspace, ThemeIcon } from "vscode";
import EntryAnchor from "./entryAnchor";
import EntryBase from "./entryBase";
import * as path from 'path';

/**
 * Represents a workspace file holding one or more anchors
 */
export default class EntryCachedFile extends EntryBase {

	constructor(
		public readonly file: Uri,
		public readonly anchors: EntryAnchor[],
	) {
		super(EntryCachedFile.fileAnchorStats(file, anchors), TreeItemCollapsibleState.Expanded);

		this.iconPath = ThemeIcon.File;
	}

	get tooltip(): string {
		return `${this.file.path}`
	}

	toString():string {
		return this.label!;
	}

	/**
	 * Formats a file stats string using the given anchors array
	 */
	static fileAnchorStats(file: Uri, anchors: EntryAnchor[]) {
		let visible = 0;
		let hidden = 0;

		anchors.forEach(anchor => {
			if(anchor.isVisibleInWorkspace) {
				visible++;
			} else {
				hidden++;
			}
		});

		let ret = visible + " Anchors";

		if(hidden > 0) {
			ret += ", " + hidden + " Hidden"
		}

		let title = " (" + ret + ")";

		const root = workspace.getWorkspaceFolder(file) || workspace.workspaceFolders![0];

		if(root) {
			title = path.relative(root.uri.path, file.path) + title;
		} else {
			title = file.path + title;
		}

		if(title.startsWith('..')) {
			throw new Error("Cannot crate cached file for external documents");
		}

		if(workspace.workspaceFolders!.length > 1) {
			let ws = root.name;

			if(ws.length > 12) {
				ws = ws.substr(0, 12) + "…";
			}

			title = ws + " → " + title;
		}

		return title;
	}

	contextValue = 'cachedFile';

}