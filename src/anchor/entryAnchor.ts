import { AnchorEngine, TagAttributes } from "../anchorEngine";
import { DecorationOptions, Range, TextDocument, Uri, window } from "vscode";

import EntryBase from "./entryBase";

/**
 * Represents an Anchor found a file
 */
export default class EntryAnchor extends EntryBase {
    /** The sorting method to use, defaults to line */
    public static SortMethod = "line";

    /** The position of the anchor when scrolled to */
    public static ScrollPosition = "top";

    /**
     * Child anchors, only present when this anchor is a region type
     */
    private childAnchors: EntryAnchor[] = [];

    constructor(
        engine: AnchorEngine,
        public readonly anchorTag: string, // The tag e.g. "ANCHOR"
        public readonly anchorText: string, // The text after the anchor tag
        public readonly startIndex: number, // The start column of the anchor
        public readonly endIndex: number, // The end column of the tag
        public readonly lineNumber: number, // The line number the tag was found on
        public readonly iconColor: string, // The icon color to use
        public readonly scope: string, // The anchor scope
        public readonly showLine: boolean, // Whether to display line numbers
        public readonly file: Uri, // The file this anchor is in
        public readonly attributes: TagAttributes // The attriibutes this tag has
    ) {
        super(engine, showLine ? `[${lineNumber}] ${anchorText}` : anchorText);

        this.command = {
            title: "",
            command: "commentAnchors.openFileAndRevealLine",
            arguments: [
                {
                    uri: file,
                    lineNumber: this.lineNumber - 1,
                    at: EntryAnchor.ScrollPosition,
                },
            ],
        };

        if (iconColor == "default" || iconColor == "auto") {
            this.iconPath = {
                light: this.loadResourceSvg("anchor_black"),
                dark: this.loadResourceSvg("anchor_white"),
            };
        } else {
            this.iconPath = this.loadCacheSvg(iconColor);
        }
    }

    contextValue = "anchor";
    tooltip = `${this.anchorText} (Click to reveal)`;

    get isVisibleInWorkspace(): boolean {
        return this.scope == "workspace";
    }

    get children(): EntryAnchor[] {
        return [...this.childAnchors];
    }

    get lensRange(): Range {
        return new Range(this.lineNumber - 1, this.startIndex, this.lineNumber - 1, this.endIndex);
    }

    decorateDocument(document: TextDocument, options: DecorationOptions[]): void {
        const startPos = document.positionAt(this.startIndex);
        const endPos = document.positionAt(this.endIndex);

        options.push({
            hoverMessage: "Comment Anchor: " + this.anchorText,
            range: new Range(startPos, endPos),
        });
    }

    addChild(child: EntryAnchor): void {
        this.childAnchors.push(child);
    }

    toString(): string {
        return "EntryAnchor(" + this.label! + ")";
    }

    copy(copyChilds: boolean, showLine: boolean | undefined = undefined): EntryAnchor {
        const copy = new EntryAnchor(
            this.engine,
            this.anchorTag,
            this.anchorText,
            this.startIndex,
            this.endIndex,
            this.lineNumber,
            this.iconColor,
            this.scope,
            showLine === undefined ? this.showLine : showLine,
            this.file,
            this.attributes
        );

        if (copyChilds) {
            this.children.forEach((child) => {
                copy.addChild(child.copy(copyChilds, showLine));
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
            switch (this.SortMethod) {
                case "line": {
                    return left.startIndex - right.startIndex;
                }
                case "type": {
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
