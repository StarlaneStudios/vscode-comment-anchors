import { TreeItem, TreeItemCollapsibleState } from "vscode";
import * as path from 'path';
import { AnchorEngine } from "../anchorEngine";

/**
 * Base class extended by all implementions of a TreeItem
 * which represent an entity in the anchor panel.
 */
export default class EntryBase extends TreeItem {

	public readonly engine: AnchorEngine

	public constructor(engine: AnchorEngine, label: string, state?: TreeItemCollapsibleState) {
		super(label, state);

		this.engine = engine;
	}

	/**
	 * Load an svg of the given name from the resource directory
	 * 
	 * @param name Icon name
	 * @returns The path
	 */
	loadResourceSvg(name: string) : string {
		return path.join(__dirname, '../../res', name + '.svg');
	}

	/**
	 * Load an svg of the given color from the resource directory.
	 * The icon must be generated first.
	 * 
	 * @param name Icon color
	 * @returns The path
	 */
	loadCacheSvg(color: string) : string {
		return path.join(this.engine.iconCache, 'anchor_' + color + '.svg');
	}

}