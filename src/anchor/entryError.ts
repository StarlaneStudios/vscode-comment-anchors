import { TreeItemCollapsibleState } from "vscode";
import { AnchorEngine } from "../anchorEngine";
import EntryBase from "./entryBase";

/**
 * Represents a caught error
 */
export default class EntryError extends EntryBase {
	
    private message: string;

    public constructor(engine: AnchorEngine, message: string) {
        super(engine, message, TreeItemCollapsibleState.None);

        this.message = message;
        this.tooltip = this.message;

        this.iconPath = {
            light: this.loadResourceSvg("cross"),
            dark: this.loadResourceSvg("cross"),
        };
    }

    public toString(): string {
        return "EntryError{}";
    }

    public contextValue = "error";
}
