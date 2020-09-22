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
  });

  register({
    tag: "TODO",
    iconColor: "blue",
    highlightColor: "#3ea8ff",
    scope: "workspace",
  });

  register({
    tag: "FIXME",
    iconColor: "red",
    highlightColor: "#F44336",
    scope: "workspace",
  });

  register({
    tag: "STUB",
    iconColor: "purple",
    highlightColor: "#BA68C8",
    scope: "file",
  });

  register({
    tag: "NOTE",
    iconColor: "orange",
    highlightColor: "#FFB300",
    scope: "file",
  });

  register({
    tag: "REVIEW",
    iconColor: "green",
    highlightColor: "#64DD17",
    scope: "workspace",
  });

  register({
    tag: "SECTION",
    iconColor: "blurple",
    highlightColor: "#896afc",
    scope: "workspace",
    isRegion: true,
  });
}
