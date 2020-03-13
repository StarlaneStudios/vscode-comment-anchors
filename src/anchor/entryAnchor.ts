import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri, window, TextDocument, Range } from "vscode";
import * as path from 'path';

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchor extends TreeItem {

	/** The sorting method to use, defaults to line */
	public static SortMethod = "line";

	/** The position of the anchor when scrolled to */
	public static ScrollPosition = "top";

	/**
	 * Child anchors, only present when this anchor is a region type
	 */
	private childAnchors: EntryAnchor[] = [];

	constructor(
		public readonly anchorTag: string,		// The tag e.g. "ANCHOR"
		public readonly anchorText: string,		// The text after the anchor tag
		public readonly startIndex: number,		// The start column of the anchor
		public readonly endIndex: number,		// The end column of the tag
		public readonly lineNumber: number,		// The line number the tag was found on
		public readonly icon: String,			// The associated icon
		public readonly scope: string,			// The anchor scope
		public readonly showLine: Boolean,		// Whether to display line numbers
		public readonly file?: Uri				// The file this anchor is in
	) {
		super("", TreeItemCollapsibleState.None);

		this.label = showLine ? `[${this.lineNumber}] ${anchorText}` : anchorText;

		this.command = file ? {
			title: '',
			command: 'commentAnchors.openFileAndRevealLine',
			arguments: [{
				uri: file,
				lineNumber: this.lineNumber - 1,
				at: EntryAnchor.ScrollPosition
			}]
		} : {
			title: '',
			command: 'revealLine',
			arguments: [{
				lineNumber: this.lineNumber - 1,
				at: EntryAnchor.ScrollPosition
			}]
		}

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `anchor_${icon == 'default' ? 'black' : icon}.svg`),
			dark: path.join(__dirname, '..', 'res', `anchor_${icon == 'default' ? 'white' : icon}.svg`)
		};
	}

	contextValue = 'anchor';

	get tooltip(): string {
		return `${this.anchorText} (Click to reveal)`
	}

	get isVisibleInWorkspace() {
		return this.scope == 'workspace';
	}

	get children() {
		return this.childAnchors;
	}

	decorateDocument(document: TextDocument, options: DecorationOptions[]) {
		const startPos = document.positionAt(this.startIndex);
		const endPos = document.positionAt(this.endIndex);

		options.push({hoverMessage: "Comment Anchor: " + this.anchorText, range: new Range(startPos, endPos)});
	}

	addChild(child: EntryAnchor) {
		this.collapsibleState = TreeItemCollapsibleState.Collapsed;
		this.childAnchors.push(child);
	}

	toString(): String {
		return "EntryAnchor(" + this.label! + ")";
	}

	copy(copyChilds: boolean) : EntryAnchor {
		let copy = new EntryAnchor(
			this.anchorTag,
			this.anchorText,
			this.startIndex,
			this.endIndex,
			this.lineNumber,
			this.icon,
			this.scope,
			this.showLine,
			this.file
		);

		if(copyChilds) {
			this.children.forEach(child => {
				copy.addChild(child.copy(copyChilds));
			});
		}

		return copy;
	}

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