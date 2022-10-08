import { writeFileSync } from "fs";
import { anchorEngine } from "./extension";
import { window, workspace, Uri, commands } from "vscode";
import { createJSONExport, createTableExport } from "./util/exporting";

/**
 * Reparse anchors in the current file
 */
export function parseCurrentAnchors() {
    if (!window.activeTextEditor) return;

    anchorEngine.parse(window.activeTextEditor.document.uri);
}

/**
 * Luanch the workspace scan
 */
export function launchWorkspaceScan() {
    anchorEngine.initiateWorkspaceScan();
}

/**
 * Toggles the visibility of comment anchors
 */
export function toggleVisibilitySetting() {
    const config = workspace.getConfiguration("commentAnchors");

    config.update("tagHighlights.enabled", !config.tagHighlights.enabled);
}

/**
 * Display a full list of registered anchors
 */
export function openTagListPanel() {
    anchorEngine.openTagListPanel();
}

/**
 * Export anchors to a file
 */
export async function exportAnchors() {
    const uri = await window.showSaveDialog({
        title: 'Comment Anchors export',
        saveLabel: 'Export',
        filters: {
            'Table format': ['csv'],
            'JSON format': ['json']
        }
    });

    if (!uri) return;

    const extIndex = uri.path.lastIndexOf('.');
    const extension = uri.path.substring(extIndex + 1);

    let exportText = '';

    if (extension == 'csv') {
        exportText = createTableExport();
    } else {
        exportText = createJSONExport();
    }

    writeFileSync(uri.fsPath, exportText);
}

/**
 * Go to the previous anchor relative to the cursor
 */
export function goToPreviousAnchor() {
    anchorEngine.jumpToRelativeAnchor('up');
}

/**
 * Go to the next anchor relative to the cursor
 */
export function goToNextAnchor() {
    anchorEngine.jumpToRelativeAnchor('down');
}

/**
 * Opens a file and reveales the given line number
 */
export function openFileAndRevealLine(options: OpenFileAndRevealLineOptions) {
    if (!options) return;

    function scrollAndMove() {
        commands.executeCommand("revealLine", {
            lineNumber: options.lineNumber,
            at: options.at,
        });
    }

    // Either open right away or wait for the document to open
    if (window.activeTextEditor && window.activeTextEditor.document.uri == options.uri) {
        scrollAndMove();
    } else {
        workspace.openTextDocument(options.uri).then((doc) => {
            window.showTextDocument(doc).then(() => {
                scrollAndMove();
            });
        });
    }
}

export type OpenFileAndRevealLineOptions = {
    uri: Uri;
    lineNumber: number;
    at: string;
};