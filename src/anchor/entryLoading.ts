import { TreeItemCollapsibleState } from "vscode";
import { AnchorEngine } from "../anchorEngine";
import EntryBase from "./entryBase";

/**
 * Represents an active workspace scan
 */
export default class EntryLoading extends EntryBase {
    constructor(engine: AnchorEngine) {
        super(engine, "Searching for anchors...", TreeItemCollapsibleState.None);

        this.iconPath = {
            light: this.loadResourceSvg("load"),
            dark: this.loadResourceSvg("load"),
        };
    }

    tooltip = this.label as string;

    toString(): string {
        return "EntryLoading{}";
    }

    contextValue = "loading";
}
