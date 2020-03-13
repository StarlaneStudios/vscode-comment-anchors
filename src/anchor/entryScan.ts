import { TreeItem, TreeItemCollapsibleState } from "vscode";
import * as path from 'path';

/**
 * Represents an empty detection
 */
export default class EntryScan extends TreeItem {

	constructor() {
		super("Click to start Workspace Scan", TreeItemCollapsibleState.None);

		this.iconPath = {
			light: path.join(__dirname, '..', 'res', `launch.svg`),
			dark: path.join(__dirname, '..', 'res', `launch.svg`)
		};

		this.command = {
			title: "Initiate scan",
			command: 'commentAnchors.launchWorkspaceScan'
		}
	}

	get tooltip(): string {
		return this.label!;
	}

	toString(): String {
		return "EntryLaunch{}";
	}

	contextValue = 'launch';

}