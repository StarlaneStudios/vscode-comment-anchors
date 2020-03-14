import { DecorationOptions, TextDocument, Range, Uri } from "vscode";
import EntryAnchor from "./entryAnchor";

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchorRegion extends EntryAnchor {

	public closeStartIndex: number = -1;
	public closeEndIndex: number = -1;
	public closeLineNumber: number = -1;

	constructor(
		public readonly anchorTag: string,
		public readonly anchorText: string,
		public readonly startIndex: number,
		public readonly endIndex: number,
		public readonly lineNumber: number,
		public readonly icon:string,
		public readonly scope: string,
		public readonly file: Uri
	) {
		super(
			anchorTag,
			anchorText,
			startIndex,
			endIndex,
			lineNumber,
			icon,
			scope,
			false, // Line numbers are handled differently
			file
		);

		this.label = `[${this.lineNumber} - ?] ${this.anchorText}`;
	}

	setEndTag(endTag: {startIndex: number, endIndex: number, lineNumber: number}) {
		this.closeStartIndex = endTag.startIndex;
		this.closeEndIndex = endTag.endIndex;
		this.closeLineNumber = endTag.lineNumber;

		this.label = `[${this.lineNumber} - ${endTag.lineNumber}] ${this.anchorText}`;
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
			this.anchorTag,
			this.anchorText,
			this.startIndex,
			this.endIndex,
			this.lineNumber,
			this.icon,
			this.scope,
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