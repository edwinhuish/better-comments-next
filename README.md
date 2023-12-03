# Better Comments Next

The Better Comments extension will help you create more human-friendly comments in your code.  
With this extension, you will be able to categorise your annotations into:

* Alerts
* Queries
* TODOs
* Highlights
* Commented out code can also be styled to make it clear the code shouldn't be there
* Any other comment styles you'd like can be specified in the settings

![Annotated code](images/better-comments.PNG)

## Configuration

This extension can be configured in User Settings or Workspace settings.

`"better-comments.multilineComments": true`  
 This setting will control whether multiline comments are styled using the annotation tags.
 When false, multiline comments will be presented without decoration.

`"better-comments.highlightPlainText": false`  
This setting will control whether comments in a plain text file are styled using the annotation tags.
When true, the tags (defaults: `! * ? //`) will be detected if they're the first character on a line.

`better-comments.tagsLight`
Overwrite tags styles of `better-comments.tags` for light themes.

`better-comments.tagsDark`
Overwrite tags styles of `better-comments.tags` for dark themes.

`better-comments.tags`
The tags are the characters or sequences used to mark a comment for decoration.
The default 5 can be modified to change the colors, and more can be added.

```json
"better-comments.tags": [
  {
    "tag": "!", // Could be string or string[]
    "color": "#FF2D00",
    "strikethrough": false,
    "underline": false,
    "backgroundColor": "transparent",
    "bold": false,
    "italic": false
  },
  {
    "tag": "?", // Could be string or string[]
    "color": "#3498DB",
    "strikethrough": false,
    "underline": false,
    "backgroundColor": "transparent",
    "bold": false,
    "italic": false
  },
  {
    "tag": "//", // Could be string or string[]
    "color": "#474747",
    "strikethrough": true,
    "underline": false,
    "backgroundColor": "transparent",
    "bold": false,
    "italic": false
  },
  {
    "tag": "todo", // Could be string or string[]
    "color": "#FF8C00",
    "strikethrough": false,
    "underline": false,
    "backgroundColor": "transparent",
    "bold": false,
    "italic": false
  },
  {
    "tag": "*", // Could be string or string[]
    "color": "#98C379",
    "strikethrough": false,
    "underline": false,
    "backgroundColor": "transparent",
    "bold": false,
    "italic": false
  }
]
```

## Supported Languages

* Any language that your editor correctly recognizes
