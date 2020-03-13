import { TreeItem, TreeItemCollapsibleState } from "vscode";
import EntryBase from "./entryBase";

/**
 * Represents a pending workspace scan
 */
export default class EntryScan extends EntryBase {

	constructor() {
		super("Click to start scanning", TreeItemCollapsibleState.None);

		this.iconPath = {
			light: this.loadIcon('launch'),
			dark: this.loadIcon('launch'),
		};

		this.command = {
			title: "Initiate scan",
			command: 'commentAnchors.launchWorkspaceScan'
		}
	}

	get tooltip(): string {
		return this.label!;
	}

	toString():string {
		return "EntryLaunch{}";
	}

	contextValue = 'launch';

}