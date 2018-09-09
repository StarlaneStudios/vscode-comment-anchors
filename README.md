# Comment Anchors

Place anchors within comments or string to place bookmarks within the context of your code. Anchors can be used to build a simple navigation, making it easier to navigate large files.

## Changelog
View the changelog [here](CHANGELOG.md)

## Features

* Place anchors in comments, strings, documentation, etc.
* Anchors can be viewed in the anchor sidebar view in the activity bar.
* Anchor names, icon colors, highlight colors, and background colors can be customized.
* Click an anchor in the sidebar view to scroll it into view. 

## Usage

The default settings come with anchors for the following tags:

* ANCHOR - Used to indicate a section in your file
* TODO - An item that is awaiting competion
* FIXME - An item that requires a bugfix
* STUB - Used for generated default snippets
* NOTE - An important note for a specific code section
* REVIEW - An item that needs additional review

In order to make an anchor, simply place the tag name in a comment, with an additional anchor message behind it. The anchor will be automatically detected and added to the Anchor List in the activity sidebar.

![Preview](media/preview.gif)

## Anchor types

All anchor types have their own icon, highlight color, and background color, which can be customized in the settings. Anchor tags can be added and removed, and can share the same icon or color.

![All tags](media/all-anchors.png)

## Configuration

Use `commentAnchors.parseDelay` to alter the delay in milliseconds between when you stop with typing and when the anchor parser starts. Increasing this value can result in better performance. (Default 200)

```
{
	"commentAnchors.parseDelay": 200
}
```

Use `commentAnchors.tagHighlights.enabled` to set whether tags are highlighted. (Default true)

```
{
	"commentAnchors.tagHighlights.enabled": true
}
```

Use `commentAnchors.tags` to configure the anchor tags. Each tag requires a `name`, `iconColor` and `highlightColor`, and optionally a `backgroundColor`.

```
"commentAnchors.tags": [
    {
      "tag": "ANCHOR",
      "iconColor": "default",
      "highlightColor": "#A8C023"
    }
]
```

## Neon tags theme
In case you prefer backgrounds on all tags, here is an example setup using background colors. Simply use this JSON as the `commentAnchors.tags` configuration to use.

```
[
	{"tag": "ANCHOR", "iconColor": "default", "highlightColor": "#A8C023", "backgroundColor": "#49511d"},
	{"tag": "TODO", "iconColor": "blue", "highlightColor": "#3ea8ff", "backgroundColor": "#0052a5"},
	{"tag": "FIXME", "iconColor": "red", "highlightColor": "#F44336", "backgroundColor": "#592c2c"},
	{"tag": "STUB", "iconColor": "purple", "highlightColor": "#BA68C8", "backgroundColor": "#48309a"},
	{"tag": "NOTE", "iconColor": "orange", "highlightColor": "#FFB300", "backgroundColor": "#806900"},
	{"tag": "REVIEW", "iconColor": "orange", "highlightColor": "#64DD17", "backgroundColor": "#3c7c10"}
]
```

## Issues

Issues and suggestions can be submitted in the GitHub repository [here](https://github.com/ExodiusStudios/vscode-comment-anchors/issues)

## Contribution

You can contribute to comment-anchors by forking the GitHub [repository](https://github.com/ExodiusStudios/vscode-comment-anchors) and submitting pull requests.

#### Thanks for using Comment Anchors! ❤️