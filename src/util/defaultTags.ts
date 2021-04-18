import { TagEntry } from "../anchorEngine";

/**
 * Register default tags to a tagMap
 *
 * @param tagMap The tagMap reference
 */
export default function registerDefaults(tagMap: Map<string, TagEntry>): void {
    function register(entry: TagEntry): void {
        tagMap.set(entry.tag.toUpperCase(), entry);
    }

    register({
        tag: "ANCHOR",
        iconColor: "default",
        highlightColor: "#A8C023",
        scope: "file",
        behavior: "anchor",
    });

    register({
        tag: "TODO",
        iconColor: "blue",
        highlightColor: "#3ea8ff",
        scope: "workspace",
        behavior: "anchor",
    });

    register({
        tag: "FIXME",
        iconColor: "red",
        highlightColor: "#F44336",
        scope: "workspace",
        behavior: "anchor",
    });

    register({
        tag: "STUB",
        iconColor: "purple",
        highlightColor: "#BA68C8",
        scope: "file",
        behavior: "anchor",
    });

    register({
        tag: "NOTE",
        iconColor: "orange",
        highlightColor: "#FFB300",
        scope: "file",
        behavior: "anchor",
    });

    register({
        tag: "REVIEW",
        iconColor: "green",
        highlightColor: "#64DD17",
        scope: "workspace",
        behavior: "anchor",
    });

    register({
        tag: "SECTION",
        iconColor: "blurple",
        highlightColor: "#896afc",
        scope: "workspace",
        behavior: "region",
    });

    register({
        tag: "LINK",
        iconColor: "#2ecc71",
        highlightColor: "#2ecc71",
        scope: "workspace",
        behavior: "link",
    });
}
