import { TreeItem, TreeItemCollapsibleState } from "vscode";
import EntryBase from "./entryBase";

/**
 * Represents an active workspace scan
 */
export default class EntryLoading extends EntryBase {

	constructor() {
		super("Searching for anchors...", TreeItemCollapsibleState.None);

		this.iconPath = {
			light: this.loadIcon('load'),
			dark: this.loadIcon('load')
		};
	}

	get tooltip(): string {
		return this.label!;
	}

	toString():string {
		return "EntryLoading{}";
	}

	contextValue = 'loading';

}