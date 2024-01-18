import { TreeItemCollapsibleState, Uri, workspace, ThemeIcon } from "vscode";
import EntryAnchor from "./entryAnchor";
import EntryBase from "./entryBase";
import * as path from "node:path";
import { AnchorEngine } from "../anchorEngine";

/**
 * Represents a workspace file holding one or more anchors
 */
export default class EntryCachedFile extends EntryBase {
	
    public constructor(engine: AnchorEngine, public readonly file: Uri, public readonly anchors: EntryAnchor[], public readonly format: string) {
        super(engine, EntryCachedFile.fileAnchorStats(file, anchors, format), TreeItemCollapsibleState.Expanded);

        this.iconPath = ThemeIcon.File;
    }

    public tooltip = `${this.file.path}`;
    public contextValue = "cachedFile";

    public toString(): string {
        return this.label as string;
    }

    /**
     * Formats a file stats string using the given anchors array
     */
    public static fileAnchorStats(file: Uri, anchors: EntryAnchor[], format: string): string {
        let visible = 0;
        let hidden = 0;

        for (const anchor of anchors) {
            if (anchor.isVisibleInWorkspace) {
                visible++;
            } else {
                hidden++;
            }
        }

        let ret = visible + " Anchors";

        if (hidden > 0) {
            ret += ", " + hidden + " Hidden";
        }

        let title = " (" + ret + ")";
        let titlePath;

        const root = workspace.getWorkspaceFolder(file) || workspace.workspaceFolders![0];

        if (root) {
            titlePath = path.relative(root.uri.path, file.path);
        } else {
            titlePath = file.path;
        }

        // Verify relativity
        if (titlePath.startsWith("..")) {
            throw new Error("Cannot crate cached file for external documents");
        }

        // Always use unix style separators
        titlePath = titlePath.replaceAll('\\', "/");

        // Tweak the path format based on settings
        if (format == "hidden") {
            title = titlePath.slice(titlePath.lastIndexOf("/") + 1);
        } else if (format == "abbreviated") {
            const segments = titlePath.split("/");
            const abbrPath = segments
                .map((segment, i) => {
                    if (i < segments.length - 1 && i > 0) {
                        return segment[0];
                    } else {
                        return segment;
                    }
                })
                .join("/");

            title = abbrPath + title;
        } else {
            title = titlePath + title;
        }

        if (workspace.workspaceFolders!.length > 1) {
            let ws = root.name;

            if (ws.length > 12) {
                ws = ws.slice(0, 12) + "…";
            }

            title = ws + " → " + title;
        }

        return title;
    }

}
