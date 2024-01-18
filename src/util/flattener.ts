import EntryAnchor from "../anchor/entryAnchor";

/**
 * Flattens hierarchical anchors into a single array
 *
 * @param anchors Array to flatten
 */
export function flattenAnchors(anchors: EntryAnchor[]): EntryAnchor[] {
    const list: EntryAnchor[] = [];

    function crawlList(anchors: EntryAnchor[]) {
        for (const anchor of anchors) {
            list.push(anchor);

            crawlList(anchor.children);
        }
    }

    crawlList(anchors);

    return list;
}
