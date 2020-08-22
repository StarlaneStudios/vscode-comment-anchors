import { TreeItem, TreeItemCollapsibleState } from "vscode";
import EntryBase from "./entryBase";
import { AnchorEngine } from "../anchorEngine";

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

  get tooltip(): string {
    return this.label!;
  }

  toString(): string {
    return "EntryLoading{}";
  }

  contextValue = "loading";
}
