import { TreeItem, TreeItemCollapsibleState } from "vscode";
import * as path from 'path';

/**
 * Base class extended by all implementions of a TreeItem
 * which represent an entity in the anchor panel.
 */
export default class EntryBase extends TreeItem {

	public constructor(label: string, state?: TreeItemCollapsibleState) {
		super(label, state);
	}

	/**
	 * Load an svg of the given name from the resource directory
	 * 
	 * @param name Icon name
	 * @returns The path
	 */
	loadIcon(name: string) : string {
		return path.join(__dirname, '../../res', name + '.svg');
	}

}