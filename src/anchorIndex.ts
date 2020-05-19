import EntryAnchor from "./anchor/entryAnchor";

/**
 * An index of all anchors found within a file
 */
export class AnchorIndex {

	/** Constant empty index */
	public static EMPTY = new AnchorIndex([]);

	/** A tree structure of entry anchors */
	public anchorTree: EntryAnchor[];

	/** Collection of anchors indexed by their content text*/
	public textIndex: Map<string, EntryAnchor> = new Map();

	constructor(anchorTree: EntryAnchor[]) {
		this.anchorTree = anchorTree;
		this.indexAnchors(anchorTree);
	}

	/**
	 * Index the given anchor array
	 * 
	 * @param list The anchor list
	 */
	private indexAnchors(list: EntryAnchor[]) {
		for(let anchor of list) {
			this.textIndex.set(anchor.anchorText, anchor);

			if(anchor.children.length) {
				this.indexAnchors(anchor.children);
			}
		}
	}

}