import { TreeItem, TreeItemCollapsibleState, DecorationOptions, Uri, OutputChannel, workspace } from "vscode";
import * as path from 'path';
import EntryAnchor from "./entryAnchor";
import { AnchorEngine } from "../anchorEngine";
import EntryBase from "./entryBase";

/**
 * Represents an Anchor found a Epic
 */
export default class EntryEpic extends EntryBase {

    public readonly epic: string
    public readonly anchors: EntryAnchor[]

    constructor(epic: string, label: string, anchors: EntryAnchor[], engine: AnchorEngine) {
        super(engine, label, TreeItemCollapsibleState.Expanded);
        this.epic = epic
        this.anchors = anchors
        // this.iconPath = {
        //     light: path.join(__dirname, '..', 'res', `book.svg`),
        //     dark: path.join(__dirname, '..', 'res', `book.svg`)
        // };
    }


    get tooltip(): string {
        return `${this.epic}`
    }

    toString(): string {
        return this.label!;
    }

    contextValue = 'epic';

}