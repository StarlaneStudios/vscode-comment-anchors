import { TreeItem, TreeItemCollapsibleState, Uri, workspace } from "vscode";
import * as path from 'path';
import EntryAnchor from "./entryAnchor";

/**
 * Represents an Anchor found a file
 */
export default class EntryCachedFile extends TreeItem {

	constructor(
		public readonly file: Uri,
		public readonly anchors: EntryAnchor[],
	) {
		super(EntryCachedFile.fileAnchorStats(file, anchors), TreeItemCollapsibleState.Expanded);

		// NOTE Disabled for now, makes opening/closing folders easier
		// this.command = {
		// 	title: '',
		// 	command: 'vscode.openFolder',
		// 	arguments: [file]
		// };

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `file.svg`),
			dark: path.join(__dirname, '..', 'res', `file.svg`)
		};
	}

	get tooltip(): string {
		return `${this.file.path}`
	}

	toString(): String {
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