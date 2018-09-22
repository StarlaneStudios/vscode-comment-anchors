import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri } from "vscode";
import * as path from 'path';

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchor extends TreeItem {

	constructor(
		public readonly anchorTag: string,
		public readonly anchorText: string,
		public readonly decorator: DecorationOptions,
		public readonly icon: String,
		public readonly file?: Uri
	) {
		super(`[${decorator.range.start.line + 1}] ${anchorText}`, TreeItemCollapsibleState.None);

		this.command = file ? {
			title: '',
			command: 'commentAnchors.openFileAndRevealLine',
			arguments: [{
				uri: file,
				lineNumber: decorator.range.start.line,
				at: 'top'
			}]
		} : {
			title: '',
			command: 'revealLine',
			arguments: [{
				lineNumber: decorator.range.start.line,
				at: 'top'
			}]
		}

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `anchor_${icon == 'default' ? 'black' : icon}.svg`),
			dark: path.join(__dirname, '..', 'res', `anchor_${icon == 'default' ? 'white' : icon}.svg`)
		};
	}

	get tooltip(): string {
		return `${this.anchorText} (Click to navigate)`
	}

	toString(): String {
		return this.label!;
	}

	contextValue = 'anchor';

}