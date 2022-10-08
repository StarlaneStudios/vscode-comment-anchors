import { TreeItemCollapsibleState } from "vscode";
import { AnchorEngine } from "../anchorEngine";
import EntryBase from "./entryBase";

/**
 * Represents an active workspace scan
 */
export default class EntryLoading extends EntryBase {
	
    public constructor(engine: AnchorEngine) {
        super(engine, "Searching for anchors...", TreeItemCollapsibleState.None);

        this.iconPath = {
            light: this.loadResourceSvg("load"),
            dark: this.loadResourceSvg("load"),
        };
    }

    public tooltip = this.label as string;
    public contextValue = "loading";

    public toString(): string {
        return "EntryLoading{}";
    }

}
