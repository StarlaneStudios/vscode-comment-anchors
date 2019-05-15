import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri, OutputChannel, workspace } from "vscode";
import * as path from 'path';
import EntryAnchor from "./entryAnchor";

/**
 * Represents an Anchor found a Epic
 */
export default class EntryEpic extends TreeItem {

	constructor(
		public readonly group: string,
		public readonly anchors: EntryAnchor[],
	) {
		super(group, TreeItemCollapsibleState.Expanded);
		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `book.svg`),
			dark: path.join(__dirname, '..', 'res', `book.svg`)
		};
	}

	get tooltip(): string {
		return `${this.group}`
	}

	toString(): String {
		return this.label!;
	}

	contextValue = 'epic';

}