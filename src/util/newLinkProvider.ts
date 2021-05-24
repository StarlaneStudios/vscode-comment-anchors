import { AnchorEngine } from "../anchorEngine";
import { CancellationToken, CodeLens, CodeLensProvider, Disposable, DocumentLink, DocumentLinkProvider, languages, ProviderResult, Range, TextDocument, Uri, window, workspace } from "vscode";
import { flattenAnchors } from "./flattener";
import { resolve, join } from "path";
import { asyncDelay } from "./asyncDelay";
import { lstatSync } from "fs";
import EntryAnchor from "../anchor/entryAnchor";
import { OpenFileAndRevealLineOptions } from "../extension";

const LINK_REGEX = /^(\.{1,2}[/\\])?(.+?)(:\d+|#[\w-]+)?$/;

export class LinkProvider implements DocumentLinkProvider {
    readonly engine: AnchorEngine;

    constructor(engine: AnchorEngine) {
        this.engine = engine;
    }

	provideDocumentLinks(document: TextDocument, token: CancellationToken): ProviderResult<DocumentLink[]> {
		if (document.uri.scheme == "output") {
            return [];
        }
		
		const index = this.engine.anchorMaps.get(document.uri);
		const list: DocumentLink[] = [];

		if(!index) {
			return [];
		}

		const flattened = flattenAnchors(index.anchorTree);
        const basePath = join(document.uri.fsPath, "..");
        const workspacePath = workspace.getWorkspaceFolder(document.uri)?.uri?.fsPath ?? "";

		flattened
			.filter((anchor) => {
				const tagId = anchor.anchorTag;
                const tag = this.engine.tags.get(tagId);

                return tag?.behavior == "link";
			})
			.forEach((anchor) => {
				const components = LINK_REGEX.exec(anchor.anchorText)!;
                const parameter = components[3] || "";
                const filePath = components[2];
                const relativeFolder = components[1];

                const fullPath = relativeFolder ? resolve(basePath, relativeFolder, filePath) : resolve(workspacePath, filePath);
                const fileUri = Uri.file(fullPath);
                const exists = lstatSync(fullPath).isFile();

				AnchorEngine.output("FileURI: " + fileUri.toString() + "#10");

				if (exists) {
					let docLink: DocumentLink;

					if (parameter.startsWith(":")) {
                        const lineNumber = parseInt(parameter.substr(1)) - 1;

						docLink = new DocumentLink(anchor.linkRange, fileUri);
						AnchorEngine.output("linkRange: " + JSON.stringify(anchor.linkRange));
						AnchorEngine.output("start: " + anchor.startIndex.toString());
						AnchorEngine.output("end: " + anchor.endIndex.toString());
						docLink.tooltip = "$(chevron-right) Click here to open file at line " + (lineNumber + 1);
					} else {
						if (parameter.startsWith("#")) {
                            const targetId = parameter.substr(1);

                            this.engine.revealAnchorOnParse = targetId;

                            if (fileUri.path == window.activeTextEditor?.document?.uri?.path) {
                                const anchors = this.engine.currentAnchors;
                                const flattened = flattenAnchors(anchors);
                                let targetRange;

                                for (const anchor of flattened) {
                                    if (anchor.attributes.id == targetId) {
										targetRange = anchor.linkRange;
                                    }
                                } // TODO Check this, might be no longer relevant

								docLink = new DocumentLink(anchor.linkRange, fileUri)
								docLink.tooltip = "$(chevron-right) Click here to go to anchor " + targetId
                            } else {
								docLink = new DocumentLink(anchor.linkRange, fileUri)
								docLink.tooltip = "$(chevron-right) Click here to open file at anchor " + targetId
                            }
                        } else {
							docLink = new DocumentLink(anchor.linkRange, fileUri)
							docLink.tooltip = "$(chevron-right) Click here to open file"
                        }
					}

					list.push(docLink);
				}
			});
			
		return list;
	}
}