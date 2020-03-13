import { TreeItem, TreeItemCollapsibleState } from "vscode";
import * as path from 'path';

/**
 * Represents an empty detection
 */
export default class EntryError extends TreeItem {

	private message: string;

	constructor(message: string) {
		super(message, TreeItemCollapsibleState.None);
		this.message = message;

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `cross.svg`),
			dark: path.join(__dirname, '..', 'res', `cross.svg`)
		};
	}

	get tooltip(): string {
		return this.message;
	}

	toString(): String {
		return "EntryError{}";
	}

	contextValue = 'error';

}