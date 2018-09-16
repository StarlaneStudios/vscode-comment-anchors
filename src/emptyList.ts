import { TreeItem, TreeItemCollapsibleState, DecorationOptions } from "vscode";
import * as path from 'path';

/**
 * Represents an empty detection
 */
export default class EmptyList extends TreeItem {

	constructor() {
		super(`No comment anchors detected`, TreeItemCollapsibleState.None);

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `cross.svg`),
			dark: path.join(__dirname, '..', 'res', `cross.svg`)
		};
	}

	get tooltip(): string {
		return `Place Comment Anchors in the current file to view them here!`
	}

	toString(): String {
		return "EmptyList{}";
	}

	contextValue = 'anchor';

}