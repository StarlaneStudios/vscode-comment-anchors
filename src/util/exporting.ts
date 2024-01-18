import { anchorEngine } from "../extension";
import { flattenAnchors } from "./flattener";
import { stringify } from 'csv-stringify/sync';

export function createTableExport(): string {
    const rows: any[] = [];

    for (const [file, anchors] of anchorEngine.anchorMaps.entries()) {
        const fullList = flattenAnchors(anchors.anchorTree);
        const filePath = file.fsPath;

        for (const anchor of fullList) {
            rows.push({
                Filename: filePath,
                Line: anchor.lineNumber,
                Tag: anchor.anchorTag,
                Text: anchor.anchorText,
                Id: anchor.attributes.id,
                Epic: anchor.attributes.epic,
            });
        }
    }

    return stringify(rows, {
        header: true,
        columns: [
            'Filename',
            'Line',
            'Tag',
            'Text',
            'Id',
            'Epic'
        ]
    });
}

export function createJSONExport(): string {
    const fileMap: any = {};

    for (const [file, anchors] of anchorEngine.anchorMaps.entries()) {
        const fullList = flattenAnchors(anchors.anchorTree);

        fileMap[file.fsPath] = fullList.map(anchor => ({
            tag: anchor.anchorTag,
            text: anchor.anchorText,
            line: anchor.lineNumber,
            id: anchor.attributes.id,
            epic: anchor.attributes.epic,
        }));
    }

    return JSON.stringify(fileMap, null, 2);
}