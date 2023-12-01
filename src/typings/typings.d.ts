interface CommentTag {
    tag: string;
    escapedTag: string;
    decoration: any;
    ranges: Array<any>;
}

interface ContributionsTag {
    tag: string;
    color: string;
    strikethrough: boolean;
    underline: boolean;
    bold: boolean;
    italic: boolean;
    backgroundColor: string;
}

interface Contributions {
    multilineComments: boolean;
    useJSDocStyle: boolean;
    highlightPlainText: boolean;
    tags: ContributionsTag[];
    tagsLight: ContributionsTag[];
    tagsDark: ContributionsTag[];
}

interface CommentConfig {
    lineComment?: string;
    blockComment?: [string, string];
}
