import { DecorationOptions, TextDocument, Range, Uri, TreeItemCollapsibleState } from "vscode";
import EntryAnchor from "./entryAnchor";
import { AnchorEngine } from "../anchorEngine";

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchorRegion extends EntryAnchor {

	public closeStartIndex: number = -1;
	public closeEndIndex: number = -1;
	public closeLineNumber: number = -1;

	constructor(
		engine: AnchorEngine,
		public readonly anchorTag: string,		// The tag e.g. "ANCHOR"
		public readonly anchorText: string,		// The text after the anchor tag
		public readonly startIndex: number,		// The start column of the anchor
		public readonly endIndex: number,		// The end column of the tag
		public readonly lineNumber: number,		// The line number the tag was found on
		public readonly iconColor: string,		// The icon color to use
		public readonly scope: string,			// The anchor scope
		public readonly showLine: Boolean,		// Whether to display line numbers
		public readonly file: Uri				// The file this anchor is in
	) {
		super(
			engine, anchorTag, anchorText, startIndex, endIndex, lineNumber,
			iconColor, scope, showLine, file
		);

		this.label = showLine ? `[${lineNumber} - ?] ${anchorText}` : anchorText;
		this.collapsibleState = TreeItemCollapsibleState.Collapsed;
	}

	setEndTag(endTag: {startIndex: number, endIndex: number, lineNumber: number}) {
		this.closeStartIndex = endTag.startIndex;
		this.closeEndIndex = endTag.endIndex;
		this.closeLineNumber = endTag.lineNumber;
		
		if(this.showLine) {
			this.label = `[${this.lineNumber} - ${endTag.lineNumber}] ${this.anchorText}`;
		}
	}

	decorateDocument(document: TextDocument, options: DecorationOptions[]) {
		super.decorateDocument(document, options);

		if(this.closeStartIndex < 0 || this.closeEndIndex < 0) return;3

		const startPos = document.positionAt(this.closeStartIndex);
		const endPos = document.positionAt(this.closeEndIndex);

		options.push({hoverMessage: "Comment Anchor End Region: " + this.anchorText, range: new Range(startPos, endPos)});
	}

	toString() {
		return "EntryAnchorRegion(" + this.label! + ")";
	}

	copy(copyChilds: boolean) : EntryAnchorRegion {
		let copy = new EntryAnchorRegion(
			this.engine,
			this.anchorTag,
			this.anchorText,
			this.startIndex,
			this.endIndex,
			this.lineNumber,
			this.iconColor,
			this.scope,
			this.showLine,
			this.file
		);

		if(this.closeStartIndex >= 0) {
			copy.setEndTag({
				startIndex: this.closeStartIndex,
				endIndex: this.closeEndIndex,
				lineNumber: this.closeLineNumber
			})
		}

		if(copyChilds) {
			this.children.forEach(child => {
				copy.addChild(child.copy(copyChilds));
			});
		}

		return copy;
	}

}