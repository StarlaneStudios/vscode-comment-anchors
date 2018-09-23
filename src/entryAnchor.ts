import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri, window } from "vscode";
import * as path from 'path';

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchor extends TreeItem {

	/** The sorting method to use, defaults to line */
	public static SortMethod = "line";

	constructor(
		public readonly anchorTag: string,
		public readonly anchorText: string,
		public readonly decorator: DecorationOptions,
		public readonly icon: String,
		public readonly scope: string,
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

	get isVisibleInWorkspace() {
		return this.scope == 'workspace';
	}

	toString(): String {
		return this.label!;
	}

	contextValue = 'anchor';

	/**
	 * Sort anchors based on the currently defined sort method
	 * 
	 * @param anchors Anchors to sort
	 */
	static sortAnchors(anchors: EntryAnchor[]): EntryAnchor[] {
		return anchors.sort((left, right) => {
			switch(this.SortMethod) {
				case 'line': {
					return left.decorator.range.start.line - right.decorator.range.start.line;
				}
				case 'type': {
					return left.anchorTag.localeCompare(right.anchorTag);
				}
				default: {
					window.showErrorMessage("Invalid sorting method: " + this.SortMethod);
					return 0;
				}
			}
		});
	}

}