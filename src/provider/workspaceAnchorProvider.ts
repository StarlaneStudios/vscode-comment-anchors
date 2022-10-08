import { TreeDataProvider, Event, TreeItem, workspace, Uri } from "vscode";
import EntryAnchor from "../anchor/entryAnchor";
import { AnchorEngine, AnyEntry, AnyEntryArray } from "../anchorEngine";
import EntryCachedFile from "../anchor/entryCachedFile";
import { AnchorIndex } from "../anchorIndex";
import { flattenAnchors } from "../util/flattener";

/**
 * AnchorProvider implementation in charge of returning the anchors in the current workspace
 */
export class WorkspaceAnchorProvider implements TreeDataProvider<AnyEntry> {
	
    public readonly provider: AnchorEngine;
    public readonly onDidChangeTreeData: Event<undefined>;

    public constructor(provider: AnchorEngine) {
        this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
        this.provider = provider;
    }

    public getTreeItem(element: AnyEntry): TreeItem {
        return element;
    }

    public getChildren(element?: AnyEntry): Thenable<AnyEntryArray> {
        return new Promise((success) => {
            if (element) {
                if (element instanceof EntryAnchor && element.children) {
                    success(element.children);
                    return;
                } else if (element instanceof EntryCachedFile) {
                    const res: EntryAnchor[] = [];

                    const cachedFile = element as EntryCachedFile;

                    if (this.provider._config!.tags.displayHierarchyInWorkspace) {
                        cachedFile.anchors.forEach((anchor: EntryAnchor) => {
                            if (!anchor.isVisibleInWorkspace) return;

                            res.push(anchor.copy(true));
                        });
                    } else {
                        flattenAnchors(cachedFile.anchors).forEach((anchor: EntryAnchor) => {
                            if (!anchor.isVisibleInWorkspace) return;

                            res.push(anchor.copy(false));
                        });
                    }

                    success(EntryAnchor.sortAnchors(res));
                } else {
                    success([]);
                }

                return;
            }

            if (!this.provider._config!.workspace.enabled) {
                success([this.provider.errorWorkspaceDisabled]);
                return;
            } else if (!workspace.workspaceFolders) {
                success([this.provider.errorFileOnly]);
                return;
            } else if (this.provider._config!.workspace.lazyLoad && !this.provider.anchorsScanned) {
                success([this.provider.statusScan]);
            } else if (!this.provider.anchorsLoaded) {
                success([this.provider.statusLoading]);
                return;
            }

            const format = this.provider._config!.workspace.pathFormat;
            const res: EntryCachedFile[] = [];

            this.provider.anchorMaps.forEach((index: AnchorIndex, document: Uri) => {
                const anchors = index.anchorTree;

                if (anchors.length == 0) return; // Skip empty files

                let notVisible = true;

                anchors.forEach((anchor) => {
                    if (anchor.isVisibleInWorkspace) notVisible = false;
                });

                if (!notVisible) {
                    try {
                        res.push(new EntryCachedFile(this.provider, document, anchors, format));
                    } catch (err) {
                        // Simply ignore, we do not want to push this file
                    }
                }
            });

            if (res.length == 0) {
                success([this.provider.errorEmptyWorkspace]);
                return;
            }

            success(
                res.sort((left, right) => {
                    const leftLabel = left.label as string;
                    const rightLabel = right.label as string;

                    return leftLabel.localeCompare(rightLabel);
                })
            );
        });
    }
}
