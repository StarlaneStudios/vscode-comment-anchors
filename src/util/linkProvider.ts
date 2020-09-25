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

class LinkCodeLensProvider implements CodeLensProvider {
  readonly engine: AnchorEngine;
  readonly onDidChangeCodeLenses: Event<void>;

  constructor(engine: AnchorEngine) {
    this.onDidChangeCodeLenses = engine._onDidChangeLensData.event;
    this.engine = engine;
  }

  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const index = this.engine.anchorMaps.get(document.uri);
    const list: CodeLens[] = [];

    if (!index || document.uri.scheme == "output") {
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
        const range = anchor.lensRange;

        list.push(
          new CodeLens(range, {
            command: "vscode.open",
            title: "$(chevron-right) Click to open linked file",
            arguments: [fileUri],
          })
        );
      });

    // AnchorEngine.output("Lenses = " + JSON.stringify(list));

    return list;
  }
}

export function setupLinkProvider(engine: AnchorEngine): Disposable {
  return languages.registerCodeLensProvider(
    { language: "*" },
    new LinkCodeLensProvider(engine)
  );
}
