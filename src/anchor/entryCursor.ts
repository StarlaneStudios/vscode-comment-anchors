import { AnchorEngine } from "../anchorEngine";
import EntryBase from "./entryBase";
import { TreeItemCollapsibleState } from "vscode";

/**
 * Represents the current cursor
 */
export default class EntryCursor extends EntryBase {
    constructor(engine: AnchorEngine, line: number) {
        super(engine, `➤ Cursor position (line ${line})`, TreeItemCollapsibleState.None);
        this.tooltip = this.label!;

        this.iconPath = {
            light: this.loadResourceSvg("cursor"),
            dark: this.loadResourceSvg("cursor"),
        };
    }

    toString(): string {
        return "EntryCursor{}";
    }

    contextValue = "cursor";
}
