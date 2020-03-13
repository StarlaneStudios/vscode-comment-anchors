import { TreeItem, TreeItemCollapsibleState } from "vscode";
import * as path from 'path';

/**
 * Represents an active workspace scan
 */
export default class EntryLoading extends TreeItem {

	constructor() {
		super("Searching for anchors...", TreeItemCollapsibleState.None);

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `load.svg`),
			dark: path.join(__dirname, '..', 'res', `load.svg`)
		};
	}

	get tooltip(): string {
		return this.label!;
	}

	toString(): String {
		return "EntryLoading{}";
	}

	contextValue = 'loading';

}