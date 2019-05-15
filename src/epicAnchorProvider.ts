import { TreeDataProvider, Event, TreeItem, TextDocument, workspace, Uri, window } from "vscode";
import EntryAnchor from "./entryAnchor";
import EntryError from "./entryError";
import { AnchorEngine } from "./anchorEngine";
import EntryCachedFile from "./entryCachedFile";
import EntryScan from "./entryScan";
import EntryAnchorRegion from "./entryAnchorRegion";
import EntryEpic from "./entryEpic";
import { stringify } from "querystring";

/**
 * The type repsenting any Entry
 */
type AnyEntry = EntryAnchor|EntryError|EntryCachedFile|EntryScan|EntryEpic;
type AnyEntryArray = EntryAnchor[]|EntryError[]|EntryCachedFile[]|EntryScan[]|EntryEpic[];

/**
 * AnchorProvider implementation in charge of returning the anchors in the current workspace
 */
export class EpicAnchorProvider implements TreeDataProvider<AnyEntry> {

	readonly provider: AnchorEngine;
	readonly onDidChangeTreeData: Event<undefined>;

	constructor(provider: AnchorEngine) {
		this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
		this.provider = provider;
	}

	getTreeItem(element: AnyEntry): TreeItem {
		return element;
	}

	getChildren(element?: AnyEntry): Thenable<AnyEntryArray> {
		return new Promise((success) => {
			if(element) {
				if(element instanceof EntryAnchor && element.children) {
					success(element.children.map((v, i)=>{
						v.label = `${i}@(seq=${v.seq})-${v.label}`
						return v
					}));
					return;
				} else if(element instanceof EntryEpic) {
					let res: EntryAnchor[] = [];
	
					const epic = (element as EntryEpic);
					
					if(this.provider._config!.tags.displayHierarchyInWorkspace) {
						epic.anchors.forEach((anchor: EntryAnchor) => {
							if(!anchor.isVisibleInWorkspace) return;
	
							res.push(anchor.copy(true));
						});
					} else {
						EpicAnchorProvider.flattenAnchors(epic.anchors).forEach((anchor: EntryAnchor) => {
							if(!anchor.isVisibleInWorkspace) return;

							res.push(anchor.copy(false));
						});
					}

					success(res.sort((left, right) => {
						return left.seq === undefined || right.seq === undefined ?  left.lineNumber - right.lineNumber : left.seq - right.seq
					}).map((v, i)=>{
						v.label = `${i}@(seq=${v.seq})-${v.label}`
						return v
					}));
				} else {
					success([]);
				}
				
				return;
			}

			if(!this.provider._config!.workspace.enabled) {
				success([this.provider.errorWorkspaceDisabled]);
				return;
			} else if(!workspace.workspaceFolders) {
				success([this.provider.errorFileOnly]);
				return;
			} else if(this.provider._config!.workspace.lazyLoad && !this.provider.anchorsScanned) {
				success([this.provider.statusScan])
			} else if(!this.provider.anchorsLoaded) {
				success([this.provider.statusLoading]);
				return;
			}

			let res: EntryEpic[] = [];
			let groupMaps = new Map<string, EntryAnchor[]>()
			Array.from(this.provider.anchorMaps).forEach((value: [Uri, EntryAnchor[]], _: number)=>{
				value[1].forEach(anchor => {
					if(typeof(anchor.group) === 'string' ){
						let anchorGroup = groupMaps.get(anchor.group)
						if(anchorGroup){
							anchorGroup.push(anchor)
						}else{
							groupMaps.set(anchor.group, [anchor])
						}
					}
				})
			})

			groupMaps.forEach((anchorArr: EntryAnchor[], group: string) =>{
				anchorArr.sort((left, right) => {
					console.log(left.seq, right.seq, (!!left.seq) && (!!right.seq))
					return 0
				})
				res.push(new EntryEpic(group, anchorArr))
			})

			success(res)
		});
	}

	/**
	 * Flattens hierarchical anchors into a single array
	 * 
	 * @param anchors Array to flatten
	 */
	static flattenAnchors(anchors: EntryAnchor[]) : EntryAnchor[] {
		let list: EntryAnchor[] = [];

		function crawlList(anchors: EntryAnchor[]) {
			anchors.forEach(anchor => {
				list.push(anchor);

				crawlList(anchor.children);
			});
		}

		crawlList(anchors);

		return list;
	}

}