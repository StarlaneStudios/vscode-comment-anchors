import { AnchorEngine, TagAttributes } from "../anchorEngine";
import { DecorationOptions, Range, TextDocument, TreeItemCollapsibleState, Uri } from "vscode";

import EntryAnchor from "./entryAnchor";

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchorRegion extends EntryAnchor {
    public closeStartIndex = -1;
    public closeEndIndex = -1;
    public closeLineNumber = -1;

    constructor(
        engine: AnchorEngine,
        public readonly anchorTag: string, // The tag e.g. "ANCHOR"
        public readonly anchorText: string, // The text after the anchor tag
        public readonly startIndex: number, // The start column of the anchor
        public readonly endIndex: number, // The end column of the tag
        public readonly anchorLength: number, // The full length of the matched anchor string
        public readonly lineNumber: number, // The line number the tag was found on
        public readonly iconColor: string, // The icon color to use
        public readonly scope: string, // The anchor scope
        public readonly showLine: boolean, // Whether to display line numbers
        public readonly file: Uri, // The file this anchor is in
        public readonly attributes: TagAttributes // The attriibutes this tag has
    ) {
        super(engine, anchorTag, anchorText, startIndex, endIndex, anchorLength, lineNumber, iconColor, scope, showLine, file, attributes);

        this.label = showLine ? `[${lineNumber} - ?] ${anchorText}` : anchorText;

        const autoExpand = engine._config!.tags.expandSections;
        this.collapsibleState = autoExpand ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;
    }

    setEndTag(endTag: { startIndex: number; endIndex: number; lineNumber: number }): void {
        this.closeStartIndex = endTag.startIndex;
        this.closeEndIndex = endTag.endIndex;
        this.closeLineNumber = endTag.lineNumber;

        if (this.showLine) {
            this.label = `[${this.lineNumber} - ${endTag.lineNumber}] ${this.anchorText}`;
        }
    }

    decorateDocumentEnd(document: TextDocument, options: DecorationOptions[]): void {
        if (this.closeStartIndex < 0 || this.closeEndIndex < 0) return;

        const startPos = document.positionAt(this.closeStartIndex);
        const endPos = document.positionAt(this.closeEndIndex);

        options.push({
            hoverMessage: "Comment Anchor End Region: " + this.anchorText,
            range: new Range(startPos, endPos),
        });
    }

    toString(): string {
        return "EntryAnchorRegion(" + this.label! + ")";
    }

    copy(copyChilds: boolean): EntryAnchorRegion {
        const copy = new EntryAnchorRegion(
            this.engine,
            this.anchorTag,
            this.anchorText,
            this.startIndex,
            this.endIndex,
            this.anchorLength,
            this.lineNumber,
            this.iconColor,
            this.scope,
            this.showLine,
            this.file,
            this.attributes
        );

        if (this.closeStartIndex >= 0) {
            copy.setEndTag({
                startIndex: this.closeStartIndex,
                endIndex: this.closeEndIndex,
                lineNumber: this.closeLineNumber,
            });
        }

        if (copyChilds) {
            this.children.forEach((child) => {
                copy.addChild(child.copy(copyChilds));
            });
        }

        return copy;
    }
}
