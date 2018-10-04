# Change Log

## 1.6.0
- Added setting to modify separators
	- "Separators" are the characters you are allowed to place between a tag and its message
	- By default, ` `, `: ` and ` - ` are allowed
	- It is adviced to remove " " from the list when disabling case matching, as otherwise many false positives can be detected by accident
- Added IntelliSense autocompletion for anchors
- Fixed issues involving editor folding
- Added setting to change where the editor scrolls to when navigating to an anchor
- Added setting to disable editor folding (May fix fold issues in some languages)
- **Possibly breaking:** Tag matching is now Case Sensitive by default 

## 1.5.0
- Added anchor regions
	- Region tags are defined by setting `isRegion` to `true`
	- Defined with a start and end tag
	- Collapsible in the anchor list and in the editor
	- Support for placing regions within regions
	- Provided default region tag "SECTION"
- Greatly improved matching of tags
- Added new icon colors (teal, pink, blurple, emerald)
	- Added icon hex codes to the extension documentation

## 1.4.3
- Added the ability to disable workspace anchors
- Fixed bad performance by excluding `node_modules` and other folders from the workspace scan by default
- Scanning now no longer triggers other extensions to parse all files
- Improved matching regex
	- Now excludes semicolons and other symbols before the comment (e.g. NOTE - Message, ANCHOR: Message)
	- Matches are now case insensitive (Can be disabled in settings)

## v1.4.0
- Added workspace anchors view
	- Allows the viewing of all anchors within one or multiple workspaces
	- Can be used for navigation
	- Tags can be scoped to display for current file only
- Fixed bugs

## v1.3.0
- Added gutter icons
- Added more tag customization styles
- Added command to toggle tag visibility
- Improved comment detecting (Works for XML/HTML files now)

## v1.2.0
- Added support for background colors

## v1.1.0
- Fixed some minor issues

## v1.0.0
- Initial release