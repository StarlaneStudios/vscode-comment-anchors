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
		public readonly icon: String,
		public readonly scope: string,
		public readonly file?: Uri
	) {
		super(
			anchorTag,
			anchorText,
			startIndex,
			endIndex,
			lineNumber,
			icon,
			scope,
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

}