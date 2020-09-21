import { DecorationOptions, Uri, window, TextDocument, Range } from "vscode";
import EntryBase from "./entryBase";
import { AnchorEngine } from "../anchorEngine";

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
    public readonly file: Uri // The file this anchor is in
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

  get tooltip(): string {
    return `${this.anchorText} (Click to reveal)`;
  }

  get isVisibleInWorkspace() {
    return this.scope == "workspace";
  }

  get children() {
    return this.childAnchors;
  }

  decorateDocument(document: TextDocument, options: DecorationOptions[]) {
    const startPos = document.positionAt(this.startIndex);
    const endPos = document.positionAt(this.endIndex);

    options.push({
      hoverMessage: "Comment Anchor: " + this.anchorText,
      range: new Range(startPos, endPos),
    });
  }

  addChild(child: EntryAnchor) {
    this.childAnchors.push(child);
  }

  toString(): string {
    return "EntryAnchor(" + this.label! + ")";
  }

  copy(copyChilds: boolean): EntryAnchor {
    const copy = new EntryAnchor(
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

    if (copyChilds) {
      this.children.forEach((child) => {
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
