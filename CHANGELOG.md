# Change Log

## [3.5]

### Features

* support wildcard and regex matching in tags ([0378da6](https://github.com/edwinhuish/better-comments-next/commit/0378da6a7fcced6a6b642a97cdb20dde79dcc4d6))
* add strict mode ([6ba29ef](https://github.com/edwinhuish/better-comments-next/commit/6ba29ef835e4547d8f84262a96421783aba20a91))
* #43 add option to highlight entrie line of line comment ([a38471a](https://github.com/edwinhuish/better-comments-next/commit/a38471a6457bd9568c78f8807e266bc88fe72995))

### Fix

* [Bug] Tag highlights broken inside Python files with triple-quoted strings Fixes edwinhuish/better-comments-next#71 ([5713baa](https://github.com/edwinhuish/better-comments-next/commit/5713baa226f10b3a625daa58161ea50bcf3df97b))
* highlight plain text ([d818f58](https://github.com/edwinhuish/better-comments-next/commit/d818f58a8e569a42c6d4821c66a7895be0aa10d2))
* #68 Multi-line highlighting is inconsistent and does not align with the behavior described in the README ([2192dae](https://github.com/edwinhuish/better-comments-next/commit/2192daea63b8701c72711e61dc9afd8136c3355a))
* Fix infinite loop problem in block and doc comments ([eb95376](https://github.com/edwinhuish/better-comments-next/commit/eb953762ea79416206c9c87083b5f9b6a3e043bc))
* #56 invaild comments configuration from language extension ([151c89f](https://github.com/edwinhuish/better-comments-next/commit/151c89f2754e4ac708c7c2979f457cd498eab4c1))
* #55 multiline comment matching issue ([a9ded68](https://github.com/edwinhuish/better-comments-next/commit/a9ded68b1f21c436dffd3afa0a7012181bbcb41f))
* #48 hightlight first line of plain text ([da03b03](https://github.com/edwinhuish/better-comments-next/commit/da03b03697358a8a8f3c66fbcabae535ab965b9b))
* react embed comment ([388dc36](https://github.com/edwinhuish/better-comments-next/commit/388dc36eb5d944bf09965f70c9cac65cc04d102c))
* plaintext configuration ([937a118](https://github.com/edwinhuish/better-comments-next/commit/937a118d438468810b835925fc7c3a366f5fc713))
* #46 extra shellscript comment check ([67d5355](https://github.com/edwinhuish/better-comments-next/commit/67d5355e9a58e9466eee9d7cc5c13e9acfb0d9e7))

### House Keeping

* fix the JSONC example format in README ([fa9c634](https://github.com/edwinhuish/better-comments-next/commit/fa9c634c1a60aabe9b2a643274a270a51d437f26))
* **lint-staged:** extend the scope of checked files ([4fc36a9](https://github.com/edwinhuish/better-comments-next/commit/4fc36a9782ea61aa8a4b01ccb94e00b8148dbfaf))
* **configuration:** optimize compileTagPattern parameter passing ([ab7648b](https://github.com/edwinhuish/better-comments-next/commit/ab7648b76f61e54689e16443e9cdd7fb3b0224e5))
* merge wildcard/regex tag flags into single tagMode ([3dd9322](https://github.com/edwinhuish/better-comments-next/commit/3dd9322e62f087ce1e7f28b753893489cf370fda))
* **release:** update workflow input parameters and fix script permissions ([20a4947](https://github.com/edwinhuish/better-comments-next/commit/20a4947c98c0a8b5dc89f7fc4d1d3759cc298104))
* **github actions:** add minor mode to the tag script and refactor code ([0c972b9](https://github.com/edwinhuish/better-comments-next/commit/0c972b92d9997c029d8e83c541574f4418c49ff7))
* refactor the release workflow ([8048d6c](https://github.com/edwinhuish/better-comments-next/commit/8048d6c6bc632daa1ee6213a3c6fb542c28c7354))
* add node types to tsconfig ([3e8c2e1](https://github.com/edwinhuish/better-comments-next/commit/3e8c2e13587f6f8a0bc9ceb5ee6c3724e941eb9a))
* simplify regular expressions and remove unused SP_BR constants ([9b9e935](https://github.com/edwinhuish/better-comments-next/commit/9b9e9352da5a539c37b6a44ecdedfa66bf3fb3fc))
* add instructions for the strict configuration ([73f3213](https://github.com/edwinhuish/better-comments-next/commit/73f3213e2d9adfa4be00acb5c3502856ef0dee42))
* remove action trigger of pull request ([1a325a2](https://github.com/edwinhuish/better-comments-next/commit/1a325a2f6f9fc446b272930652580609fe973f4e))
* Correct name of extension ([f115614](https://github.com/edwinhuish/better-comments-next/commit/f115614b236f257b5f5228e7fed1cf6e8220e3f5))
* Correct spelling in README.md ([e1b7727](https://github.com/edwinhuish/better-comments-next/commit/e1b7727e4293eb7f80aed3c48122f8ee5b8df21a))
* verify regex index until content empty ([10c7e16](https://github.com/edwinhuish/better-comments-next/commit/10c7e16fc1e64c087bebfc3165f46ed596707388))
* Optimize console log ([673d660](https://github.com/edwinhuish/better-comments-next/commit/673d660304f317c497766595499358d340149261))
* update doc ([5cc3b41](https://github.com/edwinhuish/better-comments-next/commit/5cc3b41472397df673287fc404b57ba89f8bfc09))
* separete pick comment slices ([a8021cc](https://github.com/edwinhuish/better-comments-next/commit/a8021cc014fadbc762e52685109182d2098ced9b))
* lint ([4d332fa](https://github.com/edwinhuish/better-comments-next/commit/4d332fa58c7a4204a537022ae666e25926772fbc))
* pnpm build dependencies ([134ae7d](https://github.com/edwinhuish/better-comments-next/commit/134ae7d6701a186f047e2796538821c85a2662f6))


## [3.4]

### Features

* #44 Support BUG, HACK, and FIXME comment tags ([d0cbae7](https://github.com/edwinhuish/better-comments-next/commit/d0cbae75f92389580cf3d5141fc2b6c9dccd943d))
* add preloadLines configuration. see #28 ([b36789d](https://github.com/edwinhuish/better-comments-next/commit/b36789d4a9d52b93f229c05440bb9143b01ba57d))
* add updateDelay configuration ([d73a7a7](https://github.com/edwinhuish/better-comments-next/commit/d73a7a71ca8d7643a2b78a9e5eae22ba3034c679))
* #28 Matching only visible lines ([de117a2](https://github.com/edwinhuish/better-comments-next/commit/de117a229d550c764a0b7030a5e955705e162ed4))
* #27 enhance multiline termination judgment ([38498bb](https://github.com/edwinhuish/better-comments-next/commit/38498bb635bda5f8c6ff5c98bd45bbc834bc03d0))
* Custom languages comments configuration ([1cc034b](https://github.com/edwinhuish/better-comments-next/commit/1cc034b73d9aefd00032321542f686ae12cd3ebc))
* multiline support ([5ea46f2](https://github.com/edwinhuish/better-comments-next/commit/5ea46f22b819b4e0bf3fed1370dbc226ce489903))

### Fix

* Adapt CRLF ([8d25bc1](https://github.com/edwinhuish/better-comments-next/commit/8d25bc19a0425175be0ab413d2e709c65e69da9e))
* #42 line comment ([0251476](https://github.com/edwinhuish/better-comments-next/commit/0251476f3b960fcce1dc913256edb6cb62857aaa))
* #40 hightlight bug of line tag in block comment ([9110e35](https://github.com/edwinhuish/better-comments-next/commit/9110e354ff253738ec4a14e341af3e4737d6e9cf))
* Hightlight error for doc comment #37 ([ca280b6](https://github.com/edwinhuish/better-comments-next/commit/ca280b6ef6716ddcae53bb9ec6dd07ba28d864d3))
* #34 break next multiline hightlights after break decoration of line without indentation ([997f15e](https://github.com/edwinhuish/better-comments-next/commit/997f15eec0aa480e2b4d346807074ab131aabd43))
* #36 not working for language with NO line comment ([539cc8d](https://github.com/edwinhuish/better-comments-next/commit/539cc8d82f38086ba036addc4a5eb617fc0afde9))
* #32 Unexpected multiline highlight ([b6f5d19](https://github.com/edwinhuish/better-comments-next/commit/b6f5d196e1746110369dec53cfa75cdfe80bda5e))
* doc comment multiline mode decoration offset ([d9c30fb](https://github.com/edwinhuish/better-comments-next/commit/d9c30fbb787d277017dbd852c396a3b0d4914929))
* update decoration for all visible editor ([c4453d1](https://github.com/edwinhuish/better-comments-next/commit/c4453d159af73b69deba9f444d07e6852f222418))
* skip the previous decoration jobs ([64fae5f](https://github.com/edwinhuish/better-comments-next/commit/64fae5f9c8e94dcfc7bc747a08f33992cfd055b9))
* #30 incorrect block comment matching ([7efb623](https://github.com/edwinhuish/better-comments-next/commit/7efb6238bab9f3334e166e93712384aaba4194cc))
* #30 incorrect block comment matching ([39b7b58](https://github.com/edwinhuish/better-comments-next/commit/39b7b58443e2c901dfec8f4ccd4d495d23b315ed))
* long text scrolling decoration in time ([7f132fb](https://github.com/edwinhuish/better-comments-next/commit/7f132fbabf3ce336630e96f45c17013bcd216da3))
* #28 update decorations on visible ranges changed ([e54c61a](https://github.com/edwinhuish/better-comments-next/commit/e54c61a2b767acbd82477c0cd361ad2ab725f652))
* Wrong matching of characters within a string, like '*/*' ([eb28817](https://github.com/edwinhuish/better-comments-next/commit/eb28817827e7d93004775d56340bd67c195a0fc8))
* #26 wrong matching ([96cc9be](https://github.com/edwinhuish/better-comments-next/commit/96cc9bef257d85282f611cf36d1e7177ca8e1b14))
* multi-line tag decoration in only one line ([886e85b](https://github.com/edwinhuish/better-comments-next/commit/886e85b43c5d5adda03cfd25f799da09772293dd))
* adapt to crlf line breaks ([6b18ac3](https://github.com/edwinhuish/better-comments-next/commit/6b18ac33759a074dd13c7c2ece06c75cea3104da))
* filter empty tag name ([80d298b](https://github.com/edwinhuish/better-comments-next/commit/80d298b9ffc4aec66ed08df56b4c2a5172b04df2))
* #24 ([9e2f926](https://github.com/edwinhuish/better-comments-next/commit/9e2f926b8758eea1ba02cebdb7bffb94905918f2))
* change extension start up time ([e56fb1f](https://github.com/edwinhuish/better-comments-next/commit/e56fb1faee9a1311cde6d5161ec265969319cd57))
* highlightPlainText option ([9d5fb01](https://github.com/edwinhuish/better-comments-next/commit/9d5fb0116b79cce4e3aaefbad3c053abed4b6cca))
* line comment block matching ([5f9dfc6](https://github.com/edwinhuish/better-comments-next/commit/5f9dfc62dcb2730d5fd6071fe184ba8b11a4fa6b))
* multi line comments in plain text ([4cf131f](https://github.com/edwinhuish/better-comments-next/commit/4cf131f6417d82e23260c7f40b9d29f22e792e8a))
* wrong block decoration ([20d5ee9](https://github.com/edwinhuish/better-comments-next/commit/20d5ee9bb92f1a18b1876b080a0347622c12cbea))
* cache tag decoration types, fix #23 ([2bd2ca1](https://github.com/edwinhuish/better-comments-next/commit/2bd2ca103d43f44dadadbd9799d1c639422fca8a))

### Performance

* replace processed text to empty space for better performance ([d1d4aab](https://github.com/edwinhuish/better-comments-next/commit/d1d4aabe9fbdf9070a4baaebb0d2799e38907422))
* #33 optimize the indentation mode for multi line comments ([cd685e7](https://github.com/edwinhuish/better-comments-next/commit/cd685e72148af8ca1185a2e2bd2baaff49dceacd))
* optimize performance ([b52ab67](https://github.com/edwinhuish/better-comments-next/commit/b52ab679e365eb16d750959d6d82ee997a0dc22a))
* optimize performance ([f27cbb3](https://github.com/edwinhuish/better-comments-next/commit/f27cbb35fe841e11dc948d90f27b30732aa59a3e))
* optimized code ([5c43b01](https://github.com/edwinhuish/better-comments-next/commit/5c43b01cb2cf469701e0e487ceeeaf2ae1188754))
* optimized code ([d8b9b43](https://github.com/edwinhuish/better-comments-next/commit/d8b9b4397ce1b74fc25c833654858133c8554e6d))
* optimized code ([7b61838](https://github.com/edwinhuish/better-comments-next/commit/7b61838ae534c6d81571973edfe59951c7df0832))
* Decorate only visible editor to enhance performance ([787de6f](https://github.com/edwinhuish/better-comments-next/commit/787de6f4b3959418eeea4277e0a501ee688fbb3b))
* optimized code ([fa77901](https://github.com/edwinhuish/better-comments-next/commit/fa779016998203e789f4abae7482e5d000925d5e))
* optimized code ([03cc119](https://github.com/edwinhuish/better-comments-next/commit/03cc1193f8cc84e22db9e460807e545550f86f40))
* optimized code ([13e8116](https://github.com/edwinhuish/better-comments-next/commit/13e8116a6d7833d1bc19fa7bf65743892cca87dc))
* optimized code ([0913df1](https://github.com/edwinhuish/better-comments-next/commit/0913df114f6caca680bc5fe3010b371a44d2bf16))

### House Keeping

* revert #41 ([f811b10](https://github.com/edwinhuish/better-comments-next/commit/f811b10d5417f263e88263a5b07ace715c263246))
* add doc for custom languages configuration #35 ([87fad48](https://github.com/edwinhuish/better-comments-next/commit/87fad48391a74497adc6f8851ae65f5129f48ea5))
* add default setting ([b913f6b](https://github.com/edwinhuish/better-comments-next/commit/b913f6b5b068f1bdcdd328acce1b6363105fb55a))
* update CI ([e97eb6f](https://github.com/edwinhuish/better-comments-next/commit/e97eb6f2ee0567e3aca107eaca67d1f602a7a816))
* fix CI ([22664d2](https://github.com/edwinhuish/better-comments-next/commit/22664d22a8f6f1cce78b3d0cf6d54876c68d7a6a))
* CI ([f530ea8](https://github.com/edwinhuish/better-comments-next/commit/f530ea8cfb4de1b8de74ec8dbeaefd79b2eff00b))
* change log format ([343ed85](https://github.com/edwinhuish/better-comments-next/commit/343ed8593f62fad8a59f6875d592a305c9e4f732))
* change log ([d4c75f9](https://github.com/edwinhuish/better-comments-next/commit/d4c75f95e18e1d2980c81a53583b7fcb55ac2920))
* eslint change ([a8b05ce](https://github.com/edwinhuish/better-comments-next/commit/a8b05ce3be8290824c42abaa845a4addea8215d4))
* merge language comments config ([81f08b5](https://github.com/edwinhuish/better-comments-next/commit/81f08b56b002154dcf6df21923294e6be65616d6))
* fix link ([a71ba00](https://github.com/edwinhuish/better-comments-next/commit/a71ba000f9d1cb89bee042ef595409cfee83a478))
* fix link ([e2fde59](https://github.com/edwinhuish/better-comments-next/commit/e2fde592fbd418bc129e2a7f22bf9d0461f3db93))
* related #11 ([e31fe7a](https://github.com/edwinhuish/better-comments-next/commit/e31fe7a48eb89dab8ac059b38d3b7eb07aa6b592))
* update change log ([8e47445](https://github.com/edwinhuish/better-comments-next/commit/8e474452288a53085ca062fccd7c85e29298384e))
* eslint ([8b83027](https://github.com/edwinhuish/better-comments-next/commit/8b830279a354d8b88e62e8a2016a0c64a4351ddd))
* add keywords ([ce7bf2c](https://github.com/edwinhuish/better-comments-next/commit/ce7bf2cf8b35e817dab628c294d03e4ba79fa81f))
* add ruby sample ([966876e](https://github.com/edwinhuish/better-comments-next/commit/966876eda01851fca3fb8188f5c485f6434da143))
* remove useless settings ([5f98d48](https://github.com/edwinhuish/better-comments-next/commit/5f98d488e45e415e61b322fb08be6df72aaba01e))
* eslint ignore samples folder ([3198115](https://github.com/edwinhuish/better-comments-next/commit/3198115a1b22721f32318a18d3a70e2ca153bb09))
* update readme ([99cde19](https://github.com/edwinhuish/better-comments-next/commit/99cde19f24df446cec9fa6ec8c3cac01bd6bb51a))
* update log ouput ([c008f64](https://github.com/edwinhuish/better-comments-next/commit/c008f6413b4fb373c2fcc314a694c38a3b937058))
* add log ([b6c312d](https://github.com/edwinhuish/better-comments-next/commit/b6c312db670505dd9062fda226c7060f5b1cb39e))
* update ([564bde2](https://github.com/edwinhuish/better-comments-next/commit/564bde2b1276954fdd3add2d359313335f13bfad))
* remove useless comment ([74757e1](https://github.com/edwinhuish/better-comments-next/commit/74757e14ba6496a22f0aa95a5acb5ccc9f4abf80))
* clear decoration after configuration changed ([11fed2c](https://github.com/edwinhuish/better-comments-next/commit/11fed2cc58cf6760c97aa28f6d52eed3498dc1a8))
* restore github action ([ab0c5b7](https://github.com/edwinhuish/better-comments-next/commit/ab0c5b7a5c5520de5fead3266455ea44e169000f))

## [3.3.x]

### Features

* Multi line support See [#7](https://github.com/edwinhuish/better-comments-next/issues/7)
* Custom languages comments configuration for languages configurated by [`vscode.languages.setLanguageConfiguration`](https://code.visualstudio.com/api/references/vscode-api#languages)
* Matching only visible lines See [#28](https://github.com/edwinhuish/better-comments-next/issues/28)

### Fix
* Fix PHP hash comments [#14](https://github.com/edwinhuish/better-comments-next/issues/14)
* More optimize performances...

### House Keeping
* Refactoring code for split different programming languages

## [3.2.x]

### Features

* Listen `better-comments` configuration change. See [#8](https://github.com/edwinhuish/better-comments-next/issues/8)

### Fix

* Skip decorate line comment like inside the block comment. 
* Fix python decoration. [#4](https://github.com/edwinhuish/better-comments-next/issues/4)
* Wrong matching for block comments. [#9](https://github.com/edwinhuish/better-comments-next/issues/9)

## [3.1.x]

### Features

* Add embedded languages support, read comment rules from languages configuration. See [#388](https://github.com/aaron-bond/better-comments/issues/388#issuecomment-1527426462) Now support all languages that your editor correctly recognizes.
* Support remote workspace. See [#507](https://github.com/aaron-bond/better-comments/issues/507)
* Force match tags with one space (eg. only match with "`// *comment`" or "`// * comment`", no longer match "`//* comment`". See [#2](https://github.com/edwinhuish/better-comments-next/issues/2#issuecomment-1835294075))
* Overwrite tags options for light / dark theme. See [#506](https://github.com/aaron-bond/better-comments/issues/506)
* Allow multiple tags per item. See [#33](https://github.com/aaron-bond/better-comments/issues/33)

### House Keeping
* Change class to function

## [3.0.2] (2022-07-30)

### House Keeping

* Adding Sponsor link to package.json ([c2b4992](https://github.com/aaron-bond/better-comments/commit/c2b4992)), closes [#409](https://github.com/aaron-bond/better-comments/issues/409)

## [3.0.1] (2022-07-30)

### Features

* Enabling Better Comments to run within VSCode for the Web ([3c4a6ac](https://github.com/aaron-bond/better-comments/commit/3c4a6ac)). Massive thanks to _tanhakabir_

## [3.0.0] (2022-04-05)

### Features

* Adding built in support for all languages ([e1373bf](https://github.com/aaron-bond/better-comments/commit/e1373bf)). Massive thanks to _edgardmessias_

### House Keeping

* Version bumped all dependencies
* Language support is now driven from configuration files. This means that if you have an extension which informs VSCode about a language, Better Comments will know about it too!
* Problems are likely to arise with this change, but it allows a lot more users to benefit from Better Comments without needing an explicit update for the extension adding support.

__With version 3.0.0 comes the addition of the support button on the Github page for [Better Comments](https://github.com/sponsors/aaron-bond)__  
__If you feel my work on this extension has earned me a coffee, that's the place to do it!__

_**Thanks!**_

## [2.1.0] (2020-07-13)

### Features

* Adding Bold, Italic, and Underline ([e41ccc4](https://github.com/aaron-bond/better-comments/commit/e41ccc4)), closes [#50](https://github.com/aaron-bond/better-comments/issues/50). Massive thanks to _Fr33maan_
* Adding XML support
* Adding BrightScript support

### Bug Fixes

* Fixing Shaderlab support ([f96049f](https://github.com/aaron-bond/better-comments/commit/f96049f)), closes [#245](https://github.com/aaron-bond/better-comments/issues/245)
* Fixing SASS support ([7decffb](https://github.com/aaron-bond/better-comments/commit/7decffb)), closes [#123](https://github.com/aaron-bond/better-comments/issues/123), [#215](ttps://github.com/aaron-bond/better-comments/issues/215)

## [2.0.5] (2019-05-15)

### Features

* Adding Markdown support ([54e51fb](https://github.com/aaron-bond/better-comments/commit/54e51fb)), closes [#91](https://github.com/aaron-bond/better-comments/issues/91)
* Adding Apex support ([301644e](https://github.com/aaron-bond/better-comments/commit/301644e)), closes [#143](https://github.com/aaron-bond/better-comments/issues/143)
* Adding GenStat support ([a14e24c](https://github.com/aaron-bond/better-comments/commit/a14e24c)), closes [#149](https://github.com/aaron-bond/better-comments/issues/149)
* Adding ColdFusion support ([9e2a4be](https://github.com/aaron-bond/better-comments/commit/9e2a4be)), closes [#135](https://github.com/aaron-bond/better-comments/issues/135)

## [2.0.4] (2019-05-14)

### Bug Fixes

* Fixing Groovy support ([099bcc0](https://github.com/aaron-bond/better-comments/commit/099bcc0)), closes [#150](https://github.com/aaron-bond/better-comments/issues/150)
* Fixing multiline Lua support ([7ca3164](https://github.com/aaron-bond/better-comments/commit/7ca3164)), closes [#151](https://github.com/aaron-bond/better-comments/issues/151)

### Features

* Supporting remote development, closes [#147](https://github.com/aaron-bond/better-comments/issues/147). Thanks _mjbvz_
* Adding Elm support, merges [#146](https://github.com/aaron-bond/better-comments/pull/146). Thanks _ChristianPredebon_

## [2.0.3] (2018-11-04)

### Features

* Adding Stylus support ([a57ad30](https://github.com/aaron-bond/better-comments/commit/a57ad30)), merges [#112](https://github.com/aaron-bond/better-comments/issues/112). Thanks _vednoc_
* Adding ASCIIDoc support ([60a5f5f](https://github.com/aaron-bond/better-comments/commit/60a5f5f)), closes [#107](https://github.com/aaron-bond/better-comments/issues/107)

## [2.0.2] (2018-10-10)

### Bug Fixes

* Fixing single line CSS comments([469a93f](https://github.com/aaron-bond/better-comments/commit/469a93f)), closes [#109](https://github.com/aaron-bond/better-comments/issues/109)
* Fixing support for multiline Haskell comments ([498016a](https://github.com/aaron-bond/better-comments/commit/498016a)), closes [#102](https://github.com/aaron-bond/better-comments/issues/102)

### Features

* Adding D support ([c6a619c](https://github.com/aaron-bond/better-comments/commit/c6a619c)), closes [#99](https://github.com/aaron-bond/better-comments/issues/99)

## [2.0.1] (2018-09-26)

### Bug Fixes

* Fixing issue where JSDoc block comments weren't being detected properly ([7cb9126](https://github.com/aaron-bond/better-comments/commit/7cb9126)), closes [#101](https://github.com/aaron-bond/better-comments/issues/101)

## [2.0.0] (2018-09-20)

### Features

* Block comments for lots and lots of languages. Please raise a bug or feature request if I've missed any!
* Added support for HTML
* Added support for Twig
* Added support for Puppet

### House Keeping

* I decided a major version release was appropriate for this one as it's a pretty huge set of changes in terms of how the extension functions
* It's now possible to add block comment formatting for any new languages as required. Sorry it took so long!

## [1.3.0] (2018-09-13)

### Features

* Adding support for Bibtex/Biblatex ([d1f06b6](https://github.com/aaron-bond/better-comments/commit/d1f06b6)), thanks to _JavierReyes945_, merges [#96](https://github.com/aaron-bond/better-comments/pull/96)
* Adding support for Verilog HDL ([b368b17](https://github.com/aaron-bond/better-comments/commit/b368b17)), closes [#84](https://github.com/aaron-bond/better-comments/issues/84)

### Bug Fixes

* Fixing multiline comment support for SAS and Stata ([4b40bd9](https://github.com/aaron-bond/better-comments/commit/4b40bd9)), closes [#95](https://github.com/aaron-bond/better-comments/issues/95)

## [1.2.9] (2018-09-08)

### Features

* Adding support for PlantUML ([9a446a3](https://github.com/aaron-bond/better-comments/commit/9a446a3)), thanks to _JavierReyes945_, closes [#94](https://github.com/aaron-bond/better-comments/issues/94)

## [1.2.8] (2018-09-03)

### Features

* Added support for Tcl ([52e6d35](https://github.com/aaron-bond/better-comments/commit/52e6d35)), closes [#92](https://github.com/aaron-bond/better-comments/issues/92)

## [1.2.7] (2018-09-02)

### Features

* Adding support for Flax ([71f6326](https://github.com/aaron-bond/better-comments/commit/71f6326)), merges [#76](https://github.com/aaron-bond/better-comments/issues/76)
* Adding support for multiple languages, closes [#89](https://github.com/aaron-bond/better-comments/issues/89)
  * Fortran (modern) ([8762226](https://github.com/aaron-bond/better-comments/commit/8762226))
  * SAS ([145e8d3](https://github.com/aaron-bond/better-comments/commit/145e8d3))
  * STATA ([eb0f367](https://github.com/aaron-bond/better-comments/commit/eb0f367))

### House Keeping

* Updating README to reflect actual styntax better ([71f9019](https://github.com/aaron-bond/better-comments/commit/71f9019)), merges [#77](https://github.com/aaron-bond/better-comments/issues/77)
* Messed up the incrementing of the version on this one with the gdscript merge so just pushing this as 1.2.7 for convenience

## [1.2.5] (2018-06-04)

### Features

* Adding support for COBOL ([7939ca2](https://github.com/aaron-bond/better-comments/commit/7939ca2)), merges [#34](https://github.com/aaron-bond/better-comments/issues/34)

### Bug Fixes

* Fixing plaintext highlight even when setting is false ([7939ca2](https://github.com/aaron-bond/better-comments/commit/7939ca2)), closes [#73](https://github.com/aaron-bond/better-comments/issues/73)

## [1.2.4] (2018-05-31)

### Features

* Adding new property for tags: __backgroundColor__ ([3e7a188](https://github.com/aaron-bond/better-comments/commit/3e7a188)), closes [#66](https://github.com/aaron-bond/better-comments/issues/66)
  * default: `transparent`
* Adding support for: PlainText ([27ff774](https://github.com/aaron-bond/better-comments/commit/27ff774)), closes [#39](https://github.com/aaron-bond/better-comments/issues/39)  
  * PlainText support must be turned on in the settings: `highlightPlainText`
* Adding support for: Vue.js ([2b14d2e](https://github.com/aaron-bond/better-comments/commit/2b14d2e)), closes [#71](https://github.com/aaron-bond/better-comments/issues/71)
* Adding support for: nim ([73a55f6](https://github.com/aaron-bond/better-comments/commit/73a55f6)), merges [#68](https://github.com/aaron-bond/better-comments/issues/68)
* Adding support for: HiveQL and Pig ([e1653ef](https://github.com/aaron-bond/better-comments/commit/e1653ef)), merges [#63](https://github.com/aaron-bond/better-comments/issues/63)

## [1.2.3] (2018-05-20)

### Features

* Adding support for: Dart ([7490b81](https://github.com/aaron-bond/better-comments/commit/7490b81)), closes [#65](https://github.com/aaron-bond/better-comments/issues/65)
* Adding support for: Matlab ([e35541b](https://github.com/aaron-bond/better-comments/commit/e35541b)), closes [#58](https://github.com/aaron-bond/better-comments/issues/58)

### Bug Fixes

* Fixing support for SCSS ([2b3919f](https://github.com/aaron-bond/better-comments/commit/2b3919f)), closes [#60](https://github.com/aaron-bond/better-comments/issues/60)
* Fixing Python to prevent first line of the file being detected as a comment,  
([438e0a6](https://github.com/aaron-bond/better-comments/commit/438e0a6)), closes [#61](https://github.com/aaron-bond/better-comments/issues/61)

## [1.2.2] (2018-04-15)

### Features

* Adding support for: JSON with comments ([6f0b330](https://github.com/aaron-bond/better-comments/commit/6f0b330)), closes [#51](https://github.com/aaron-bond/better-comments/issues/51)
* Adding support for: AL ([de86410](https://github.com/aaron-bond/better-comments/commit/de86410)), closes [#54](https://github.com/aaron-bond/better-comments/issues/54)
* Adding support for: TypeScript React (.tsx) ([e884b37](https://github.com/aaron-bond/better-comments/commit/e884b37)), closes [#56](https://github.com/aaron-bond/better-comments/issues/56)

## [1.2.1] (2018-03-20)

### Features

* Adding support for: Terraform ([c5edd8d](https://github.com/aaron-bond/better-comments/commit/c5edd8d)), closes [#48](https://github.com/aaron-bond/better-comments/issues/48)

### Bug Fixes

* Fixing logic to run the decorations properly when switching back from an unsupported language ([756e0e0](https://github.com/aaron-bond/better-comments/commit/756e0e0)), closes [#47](https://github.com/aaron-bond/better-comments/issues/47)
* Fixing decoration of strikethrough on multiline comments to start in the correct location ([c4372e7](https://github.com/aaron-bond/better-comments/commit/c4372e7)), closes [#46](https://github.com/aaron-bond/better-comments/issues/46)

## [1.2.0] (2018-03-19)

### Features

* Adding support for: Clojure, Racket, Lisp ([88e0720](https://github.com/aaron-bond/better-comments/commit/88e0720)), merges [#40](https://github.com/aaron-bond/better-comments/pull/40)
* Adding support for: Yaml ([e9f40a0](https://github.com/aaron-bond/better-comments/commit/e9f40a0)), merges [#37](https://github.com/aaron-bond/better-comments/pull/37)
* Adding support for: Pascal ([655f61f](https://github.com/aaron-bond/better-comments/commit/655f61f)), closes [#41](https://github.com/aaron-bond/better-comments/pull/37)

### Bug Fixes

* Fixing crash when unsupported language is opened in the window ([e9f40a0](https://github.com/aaron-bond/better-comments/commit/e9f40a0)), closes [#35](https://github.com/aaron-bond/better-comments/issues/35)

## [1.1.9] (2018-02-11)

### Features

* Adding support for Julia ([1b24ce1](https://github.com/aaron-bond/better-comments/commit/1b24ce1))

## [1.1.8] (2018-01-23)

### Features

* Adding support for GraphQL ([bcfcefa](https://github.com/aaron-bond/better-comments/commit/bcfcefa)), closes [#28](https://github.com/aaron-bond/better-comments/issues/28)

### Bug Fixes

* Expanding non-JSDoc block comment detection ([dccd467](https://github.com/aaron-bond/better-comments/commit/dccd467)), closes [#20](https://github.com/aaron-bond/better-comments/issues/20)

## [1.1.7] (2018-01-07)

### Bug Fixes

* Fixing comment detection when tabs are used to start the comment ([2f08fb9](https://github.com/aaron-bond/better-comments/commit/2f08fb9)), closes [#25](https://github.com/aaron-bond/better-comments/issues/25), thanks to _bekorn_

## [1.1.6] (2018-01-15)

### Features

* Adding multiple new languages ([586f325](https://github.com/aaron-bond/better-comments/commit/586f325)), thanks to _Jooseppi12_

## [1.1.5] (2018-01-14)

#### Bug Fixes

* Fixing multiline comment detection with non-English characters ([deff42b](https://github.com/aaron-bond/better-comments/commit/deff42b)), closes [#24](https://github.com/aaron-bond/better-comments/issues/24)

## [1.1.4] (2018-01-04)

#### Features

* Adding activation event and new comment type for VB.NET ("vb") ([45199a9](https://github.com/aaron-bond/better-comments/commit/45199a9)), closes [#21](https://github.com/aaron-bond/better-comments/issues/21)

## [1.1.3] (2017-12-22)

#### Features

* Adding activation event for React ("javascriptreact") ([e54ae83](https://github.com/aaron-bond/better-comments/commit/e54ae83)), closes [#19](https://github.com/aaron-bond/better-comments/issues/19)

## [1.1.2] (2017-12-16)

#### Bug Fixes

* Fixed wrong delimiter for Lua ([4bb1e2f](https://github.com/aaron-bond/better-comments/commit/4bb1e2f)), closes [#17](https://github.com/aaron-bond/better-comments/issues/17)

## [1.1.1] (2017-12-12) : Accidental Increment

#### Bug Fixes

* Fixing issue with options configuration ([0a00618](https://github.com/aaron-bond/better-comments/commit/0a00618)), closes [#16](https://github.com/aaron-bond/better-comments/issues/16)

## [1.0.0] (2017-12-06)

#### Bug Fixes

* Fixing support for JSDoc style block comments ([69a36bf](https://github.com/aaron-bond/better-comments/commit/69a36bf)), closes [#13](https://github.com/aaron-bond/better-comments/issues/13)

#### Features

* Adding support for MANY languages ([0e7eab9](https://github.com/aaron-bond/better-comments/commit/0e7eab9d352780bfb303caf090e186c15bdcc77b)), closes [#8](https://github.com/aaron-bond/better-comments/issues/8), [#9](https://github.com/aaron-bond/better-comments/issues/9)
* Adding customisable comment annotation indicators, closes [#11](https://github.com/aaron-bond/better-comments/issues/11)

## [0.1.3] (2017-07-17)

#### Bug Fixes

* Fixing an issue where multi-line comments would not be detected if preceded by some indentation ([c36821b](https://github.com/aaron-bond/better-comments/commit/c36821b))

#### Features

* Adding language support for `Go`

Thanks to __pwebly__ for both of these additions :)

## [0.1.2] (2017-07-14)

#### Bug Fixes

* Fixing issue with `TODO` and `:` in multiline comments ([5f4d049](https://github.com/aaron-bond/better-comments/commit/5f4d049)), closes [#5](https://github.com/aaron-bond/better-comments/issues/5)

## [0.1.1] (2017-07-12)

#### Features

* Adding language support for `C` (thanks to _TheWhoAreYouPerson_) ([6f3b852](https://github.com/aaron-bond/better-comments/commit/6f3b852))
* Adding support for multiline comments (special thanks to _kurozael_ for the suggestion and help implementing) ([cc82fca](https://github.com/aaron-bond/better-comments/commit/cc82fca))
  * Also adding contribution point for this: __multilineComments__: set this to false to disable

## [0.1.0] (2017-06-15)

#### Features

* Adding new comment type contribution point: __highlightColor__ ([07bd22f](https://github.com/aaron-bond/better-comments/commit/07bd22f))

#### Bug Fixes

* Fixing issue where comment format conflicts with linters expecting a space after initial `//` (special thanks to _TobiasBales_)

#### House Keeping

* Added TravisCI config to run unit tests on check in ([bd4b7b2](https://github.com/aaron-bond/better-comments/commit/bd4b7b2))
* Updated README and demo image to show new comment type ([0cbbccb](https://github.com/aaron-bond/better-comments/commit/0cbbccb))

## [0.0.3] (2017-06-09)

Initial release to VSCode marketplace
