import { TreeItem, TreeItemCollapsibleState } from "vscode";
import EntryBase from "./entryBase";
import { AnchorEngine } from "../anchorEngine";

/**
 * Represents a caught error
 */
export default class EntryError extends EntryBase {
    private message: string;

    constructor(engine: AnchorEngine, message: string) {
        super(engine, message, TreeItemCollapsibleState.None);

        this.message = message;
        this.tooltip = this.message;

        this.iconPath = {
            light: this.loadResourceSvg("cross"),
            dark: this.loadResourceSvg("cross"),
        };
    }

    toString(): string {
        return "EntryError{}";
    }

    contextValue = "error";
}
