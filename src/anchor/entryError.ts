import { TreeItem, TreeItemCollapsibleState } from "vscode";
import EntryBase from "./entryBase";

/**
 * Represents a caught error
 */
export default class EntryError extends EntryBase {

	private message: string;

	constructor(message: string) {
		super(message, TreeItemCollapsibleState.None);
		this.message = message;

		this.iconPath = {
			light: this.loadIcon('cross'),
			dark: this.loadIcon('cross')
		};
	}

	get tooltip(): string {
		return this.message;
	}

	toString():string {
		return "EntryError{}";
	}

	contextValue = 'error';

}