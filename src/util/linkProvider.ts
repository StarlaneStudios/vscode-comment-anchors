import { AnchorEngine } from "../anchorEngine";
import {
  CodeLens,
  CodeLensProvider,
  Disposable,
  Event,
  languages,
  Position,
  TextDocument,
  Uri,
} from "vscode";
import { flattenAnchors } from "./flattener";
import { resolve, join } from "path";
import { asyncDelay } from "./asyncDelay";
import { existsSync, fstat, lstatSync } from "fs";

class LinkCodeLensProvider implements CodeLensProvider {
  readonly engine: AnchorEngine;

  constructor(engine: AnchorEngine) {
    // this.onDidChangeCodeLenses = engine._onDidChangeLensData.event;
    this.engine = engine;
  }

  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    if (document.uri.scheme == "output") {
      return [];
    }

    while (this.engine.anchorsDirty) {
      await asyncDelay(100);
    }

    const index = this.engine.anchorMaps.get(document.uri);
    const list: CodeLens[] = [];

    if (!index) {
      return [];
    }

    const flattened = flattenAnchors(index.anchorTree);
    const basePath = join(document.uri.fsPath, "..");

    flattened
      .filter((anchor) => {
        const tagId = anchor.anchorTag;
        const tag = this.engine.tags.get(tagId);

        return tag?.behavior == "link";
      })
      .forEach((anchor) => {
        const fullPath = resolve(basePath, anchor.anchorText);
        const fileUri = Uri.file(fullPath);
        const exists = lstatSync(fullPath).isFile();

        if (exists) {
          list.push(
            new CodeLens(anchor.lensRange, {
              command: "vscode.open",
              title: "$(chevron-right) Click here to open file",
              arguments: [fileUri],
            })
          );
        } else {
          list.push(
            new CodeLens(anchor.lensRange, {
              command: "",
              title: "$(chrome-close) File not found",
              arguments: [fileUri],
            })
          );
        }
      });

    AnchorEngine.output("Lenses = " + list.length);

    return list;
  }
}

export function setupLinkProvider(engine: AnchorEngine): Disposable {
  return languages.registerCodeLensProvider(
    { language: "*" },
    new LinkCodeLensProvider(engine)
  );
}
