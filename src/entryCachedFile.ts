import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri, OutputChannel } from "vscode";
import * as path from 'path';
import EntryAnchor from "./entryAnchor";

/**
 * Represents an Anchor found a file
 */
export default class EntryCachedFile extends TreeItem {

	constructor(
		private readonly root: string,
		public readonly file: Uri,
		public readonly anchors: EntryAnchor[]
	) {
		super(`${EntryCachedFile.toRelative(root, file)} (${EntryCachedFile.fileAnchorStats(anchors)})`, TreeItemCollapsibleState.Expanded);

		this.command = {
			title: '',
			command: 'vscode.openFolder',
			arguments: [file]
		};

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `file.svg`),
			dark: path.join(__dirname, '..', 'res', `file.svg`)
		};
	}

	get tooltip(): string {
		return `${this.file.path} (Click to open)`
	}

	toString(): String {
		return this.label!;
	}

	/**
	 * Converts an absolute path to relative
	 * 
	 * NOTE Might not be the best way to do
	 */
	static toRelative(root: string, file: Uri) {
		return path.relative('/' + root.replace(/\\/g, '/'), file.path);
	}

	/**
	 * Formats a file stats string using the given anchors array
	 */
	static fileAnchorStats(anchors: EntryAnchor[]) {
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

		return ret;
	}

	contextValue = 'cachedFile';

}