"use strict";
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const mkdirp_1 = require("mkdirp");
const glob_1 = require("glob");
const process_1 = require("process");
const Yargs = require("yargs");
const colors_1 = require("colors");
const checkFileExists = (filePath) => {
    return new Promise((resolve) => {
        fs_1.access(filePath, fs_1.constants.F_OK, (err) => {
            if (err) {
                resolve(false);
            }
            resolve(true);
        });
    });
};
const execOnlyErrorOutput = (command) => {
    child_process_1.execSync(command, { stdio: ["ignore", "ignore", "pipe"] });
};
const processSingleFile = (filePath, langs) => {
    checkFileExists(filePath).then((flag) => {
        return flag ? fs_1.readFileSync(filePath).includes("gettext") : false;
    }).then((flag) => {
        if (flag) {
            const dir = path_1.dirname(filePath);
            const filename = path_1.basename(filePath, path_1.extname(filePath));
            const poFileDir = path_1.join(dir, "langs");
            const potFilePath = path_1.join(poFileDir, `${filename}.pot`);
            mkdirp_1.sync(poFileDir);
            execOnlyErrorOutput(`xgettext --language=JavaScript --add-comments --sort-output --from-code=UTF-8 --no-location --msgid-bugs-address=wanglin@ezbuy.com -o ${potFilePath} ${filePath}`);
            checkFileExists(potFilePath).then((ifPotFileExists) => {
                if (ifPotFileExists) {
                    console.log(colors_1.green(filePath));
                    fs_1.writeFileSync(potFilePath, fs_1.readFileSync(potFilePath).toString().replace("charset=CHARSET", "charset=UTF-8"));
                    langs.forEach(({ lang, suffixCode }) => {
                        const poFilePath = path_1.join(poFileDir, `${filename}${suffixCode === "" ? "" : `.${suffixCode}`}.po`);
                        checkFileExists(poFilePath).then((ifExists) => {
                            if (ifExists) {
                                execOnlyErrorOutput(`msgmerge --output-file=${poFilePath} ${poFilePath} ${potFilePath}`);
                            }
                            else {
                                execOnlyErrorOutput(`msginit --no-translator --input=${potFilePath} --locale=${lang} --output=${poFilePath}`);
                            }
                        });
                    });
                }
            });
        }
    }).catch((e) => {
        console.error(e);
    });
};
const getMatchFiles = (fileMatches = "**/*.+(ts|tsx|js|jsx)", baseDir = process_1.cwd()) => {
    const options = {
        cwd: baseDir
    };
    return glob_1.sync(fileMatches, options);
};
const langs = [
    { lang: "en", suffixCode: "" },
    { lang: "th", suffixCode: "th" },
    { lang: "my", suffixCode: "my" },
    { lang: "id", suffixCode: "id" },
];
const doProcess = (filesMatches = "**/*.+(ts|tsx|js|jsx)", baseDir = process_1.cwd(), useGitStatusFiles = false) => {
    const files = useGitStatusFiles ? [] : getMatchFiles(filesMatches, baseDir);
    files.map((filePath) => path_1.join(baseDir, filePath)).forEach((filePath) => {
        processSingleFile(filePath, langs);
    });
};
const argv = Yargs.usage("Usage: $0 [options]")
    .example("$0 -f **/*.+(ts|tsx|js|jsx) -d ./", "generate langs director / pot or po files.")
    .alias("f", "file matches")
    .describe("f", "Load File Matches Use minimatch style.")
    .alias("d", "search directory")
    .describe("f", "Search files from these directories.")
    .boolean("g")
    .alias("g", "use git status files")
    .describe("g", "Search files only in git status outputs.")
    .help("h")
    .alias("h", "help")
    .argv;
doProcess(argv.f, argv.d, argv.g);
