"use strict";
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const mkdirp_1 = require("mkdirp");
const glob_1 = require("glob");
const process_1 = require("process");
const Yargs = require("yargs");
const colors_1 = require("colors");
const minimatch_1 = require("minimatch");
const os_1 = require("os");
const rimraf = require("rimraf");
const defaultLangs = ["en", "th", "my", "id"];
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
                    langs.forEach((lang) => {
                        const poFilePath = path_1.join(poFileDir, `${filename}${lang === "" ? "" : `.${lang}`}.po`);
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
                else {
                    if (fs_1.readdirSync(poFileDir).length === 0) {
                        rimraf.sync(poFileDir);
                    }
                }
            });
        }
    }).catch((e) => {
        console.error(e);
    });
};
const getMatchFiles = (fileMatches, baseDir) => {
    const options = {
        cwd: baseDir
    };
    return glob_1.sync(fileMatches, options);
};
const getStashFiles = (fileMatches, baseDir) => {
    const result = child_process_1.execSync("git status -s", { cwd: baseDir });
    return result.toString().split(os_1.EOL).filter((path) => path !== "").map((path) => path.slice(3)).filter(minimatch_1.filter(fileMatches));
};
const doGenLangs = (filesMatches = "**/*.+(ts|tsx|js|jsx)", baseDir = process_1.cwd(), useGitStatusFiles = false, langs = defaultLangs) => {
    const files = (useGitStatusFiles ? getStashFiles(filesMatches, baseDir) : getMatchFiles(filesMatches, baseDir)).map((filePath) => path_1.join(baseDir, filePath));
    files.forEach((filePath) => {
        processSingleFile(filePath, langs);
    });
};
const doPackLangs = (output, baseDir = process_1.cwd(), langs = defaultLangs) => {
    const poFiles = glob_1.sync(`**/langs/*.+(${langs.join("|")}).po`, { cwd: baseDir });
    const outDirAlreadyCreated = {};
    poFiles.forEach((path) => {
        const outDirPath = path_1.join(baseDir, output, path_1.dirname(path).split(path_1.sep).reverse().join("."));
        if (!outDirAlreadyCreated[outDirPath]) {
            outDirAlreadyCreated[outDirPath] = true;
            mkdirp_1.sync(outDirPath);
        }
        console.log(outDirPath);
        fs_1.createReadStream(path_1.join(baseDir, path)).pipe(fs_1.createWriteStream(path_1.join(outDirPath, path_1.basename(path))));
    });
};
Yargs.usage("Usage: [command] $0 [options]")
    .example("$0 gen -f **/*.+(ts|tsx|js|jsx) -d ./", "generate langs director / pot or po files.")
    .alias("d", "search directory")
    .describe("d", "Search files from the directory.")
    .array("l")
    .alias("l", "generate locales default is en th my id")
    .command("gen", "generate language files for special path", (yargs) => {
    return yargs.alias("f", "file matches")
        .describe("f", "Load File Matches Use minimatch style.")
        .boolean("s")
        .alias("s", "use git status -s files")
        .describe("s", "Search files only in git status outputs.")
        .help("h")
        .alias("h", "help")
        .argv;
}, (argv) => {
    doGenLangs(argv.f, argv.d, argv.g, argv.l);
})
    .command("langspack", "get langs pack from source code", (yargs) => {
    return yargs
        .alias("o", "output")
        .describe("o", "output path")
        .demandOption(["o"])
        .argv;
}, (argv) => {
    doPackLangs(argv.o, argv.d, argv.l);
})
    .argv;
