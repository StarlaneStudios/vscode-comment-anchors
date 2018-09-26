import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri, window, TextDocument, Range } from "vscode";
import * as path from 'path';
import { AnchorEngine } from "./anchorEngine";

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchor extends TreeItem {

	/** The sorting method to use, defaults to line */
	public static SortMethod = "line";

	constructor(
		public readonly anchorTag: string,
		public readonly anchorText: string,
		public readonly startIndex: number,
		public readonly endIndex: number,
		public readonly lineNumber: number,
		public readonly icon: String,
		public readonly scope: string,
		public readonly file?: Uri
	) {
		super("", TreeItemCollapsibleState.None);

		this.label = `[${this.lineNumber}] ${anchorText}`;

		this.command = file ? {
			title: '',
			command: 'commentAnchors.openFileAndRevealLine',
			arguments: [{
				uri: file,
				lineNumber: this.lineNumber - 1,
				at: 'top'
			}]
		} : {
			title: '',
			command: 'revealLine',
			arguments: [{
				lineNumber: this.lineNumber - 1 ,
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

	toDecorator(document: TextDocument) : DecorationOptions {
		const startPos = document.positionAt(this.startIndex);
		const endPos = document.positionAt(this.endIndex);

		return {hoverMessage: "Comment Anchor: " + this.anchorText, range: new Range(startPos, endPos)};
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
					return left.startIndex - right.startIndex;
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