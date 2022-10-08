import { TreeItemCollapsibleState } from "vscode";
import { AnchorEngine } from "../anchorEngine";
import EntryAnchor from "./entryAnchor";
import EntryBase from "./entryBase";

/**
 * Represents an Anchor found a Epic
 */
export default class EntryEpic extends EntryBase {
	
    public readonly epic: string;
    public readonly anchors: EntryAnchor[];

    public constructor(epic: string, label: string, anchors: EntryAnchor[], engine: AnchorEngine) {
        super(engine, label, TreeItemCollapsibleState.Expanded);

        this.epic = epic;
        this.anchors = anchors;
        this.tooltip = `${this.epic}`;
        // this.iconPath = {
        //     light: path.join(__dirname, '..', 'res', `book.svg`),
        //     dark: path.join(__dirname, '..', 'res', `book.svg`)
        // };
    }

    public toString(): string {
        return this.label as string;
    }

    public contextValue = "epic";
}
