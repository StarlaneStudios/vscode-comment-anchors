import { AnchorEngine, FileEntry } from "../anchorEngine";
import { Event, TreeDataProvider, TreeItem } from "vscode";

import EntryAnchor from "../anchor/entryAnchor";
import EntryBase from "../anchor/entryBase";
import EntryCursor from "../anchor/entryCursor";
import { window } from "vscode";

/**
 * AnchorProvider implementation in charge of returning the anchors in the current file
 */
export class FileAnchorProvider implements TreeDataProvider<EntryBase> {
	
    public readonly provider: AnchorEngine;
    public readonly onDidChangeTreeData: Event<undefined>;

    private renderCursor = true;
    private cursorFound = false;

    public constructor(provider: AnchorEngine) {
        this.onDidChangeTreeData = provider._onDidChangeTreeData.event;
        this.provider = provider;
    }

    public getTreeItem(element: FileEntry): TreeItem {
        return element;
    }

    public getChildren(element?: FileEntry): Thenable<EntryBase[]> {
        if (element) {
            if (element instanceof EntryAnchor && element.children) {
                let children: EntryBase[] = element.children.filter((child) => !child.isHidden);

                if (this.renderCursor) {
                    children = this.insertCursor(children);
                }

                return Promise.resolve(children); // Insert
            }

            return Promise.resolve([]);
        }

        this.cursorFound = false;

        const fileAnchors = this.provider.currentAnchors.filter((child) => !child.isHidden);

        // Return result
        return new Promise((resolve) => {
            if (!this.provider.anchorsLoaded) {
                resolve([this.provider.statusLoading]);
            } else if (this.provider._editor == undefined) {
                resolve([this.provider.errorUnusableItem]);
            } else if (fileAnchors.length === 0) {
                resolve([this.provider.errorEmptyItem]);
            } else {
                let anchors: EntryBase[] = EntryAnchor.sortAnchors(fileAnchors);

                if (this.renderCursor) {
                    anchors = this.insertCursor(anchors);
                }

                resolve(anchors); // Insert
            }
        });
    }

    public insertCursor(anchors: EntryBase[]): EntryBase[] {
        const cursor = window.activeTextEditor?.selection?.active?.line;

        if (!this.provider._config!.showCursor || cursor === undefined) {
            return anchors;
        }

        const ret = [];

        for (const anchor of anchors) {
            if (!this.cursorFound && anchor instanceof EntryAnchor && anchor.lineNumber > cursor) {
                ret.push(new EntryCursor(this.provider, cursor + 1));
                this.cursorFound = true;
            }

            ret.push(anchor);
        }

        return ret;
    }
}
