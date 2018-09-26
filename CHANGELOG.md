# Change Log

## 1.4.2
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