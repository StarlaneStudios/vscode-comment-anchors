import { TreeItemCollapsibleState } from "vscode";
import { AnchorEngine } from "../anchorEngine";
import EntryBase from "./entryBase";

/**
 * Represents a pending workspace scan
 */
export default class EntryScan extends EntryBase {
	
    public constructor(engine: AnchorEngine) {
        super(engine, "Click to start scanning", TreeItemCollapsibleState.None);

        this.iconPath = {
            light: this.loadResourceSvg("launch"),
            dark: this.loadResourceSvg("launch"),
        };

        this.command = {
            title: "Initiate scan",
            command: "commentAnchors.launchWorkspaceScan",
        };
    }

    public tooltip = this.label as string;
    public contextValue = "launch";

    public toString(): string {
        return "EntryLaunch{}";
    }

}
