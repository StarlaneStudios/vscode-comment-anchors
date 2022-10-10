import { commands, ExtensionContext } from "vscode";
import { AnchorEngine } from "./anchorEngine";

import {
    parseCurrentAnchors,
    toggleVisibilitySetting,
    launchWorkspaceScan,
    openFileAndRevealLine,
    openTagListPanel,
    exportAnchors,
    goToNextAnchor,
    goToPreviousAnchor,
    openAnchorList
} from "./commands";

export let anchorEngine: AnchorEngine;

export function activate(context: ExtensionContext): void {
    anchorEngine = new AnchorEngine(context);

    // Register extension commands
    commands.registerCommand("commentAnchors.parse", parseCurrentAnchors);
    commands.registerCommand("commentAnchors.toggle", toggleVisibilitySetting);
    commands.registerCommand("commentAnchors.openFileAndRevealLine", openFileAndRevealLine);
    commands.registerCommand("commentAnchors.launchWorkspaceScan", launchWorkspaceScan);
    commands.registerCommand("commentAnchors.exportAnchors", exportAnchors);
    commands.registerCommand("commentAnchors.listTags", openTagListPanel);
    commands.registerCommand("commentAnchors.previousAnchor", goToPreviousAnchor);
    commands.registerCommand("commentAnchors.nextAnchor", goToNextAnchor);
    commands.registerCommand("commentAnchors.navigateToAnchor", openAnchorList);
}

export function deactivate(): void {
    anchorEngine.dispose();
}