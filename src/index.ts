import { execSync } from "child_process";
import {access, constants, readFileSync, writeFileSync} from "fs";
import {dirname, basename, join, extname} from "path";
import {sync as mkdirpSync} from "mkdirp";
import {sync as globSync, IOptions} from "glob";
import { cwd } from "process";
import * as Yargs from "yargs";
import { green } from "colors";
import { filter } from "minimatch";
import { EOL } from "os";

interface ILang {
	lang: string;
	suffixCode: string;
}

const checkFileExists = (filePath: string) => {
	return new Promise((resolve) => {
		access(filePath, constants.F_OK, (err) => {
			if (err){
				resolve(false);
			}
			resolve(true);
		});
	});
};

const execOnlyErrorOutput = (command: string) => {
	execSync(command, {stdio: ["ignore", "ignore", "pipe"]});
};

const processSingleFile = (filePath: string, langs: ILang[]) => {
	checkFileExists(filePath).then((flag) => {
		return flag ? readFileSync(filePath).includes("gettext") : false;
	}).then((flag) => {
		if (flag) {
			const dir = dirname(filePath);
			const filename = basename(filePath, extname(filePath));
			const poFileDir = join(dir, "langs");
			const potFilePath = join(poFileDir, `${filename}.pot`);

			mkdirpSync(poFileDir);

			execOnlyErrorOutput(`xgettext --language=JavaScript --add-comments --sort-output --from-code=UTF-8 --no-location --msgid-bugs-address=wanglin@ezbuy.com -o ${potFilePath} ${filePath}`);

			checkFileExists(potFilePath).then((ifPotFileExists) => {
				if (ifPotFileExists) {
					console.log(green(filePath));
					writeFileSync(potFilePath, readFileSync(potFilePath).toString().replace("charset=CHARSET", "charset=UTF-8"));
					langs.forEach(({lang, suffixCode}) => {
						const poFilePath = join(poFileDir, `${filename}${suffixCode === "" ? "" :`.${suffixCode}` }.po`);
						checkFileExists(poFilePath).then((ifExists) => {
							if (ifExists) {
								execOnlyErrorOutput(`msgmerge --output-file=${poFilePath} ${poFilePath} ${potFilePath}`);
							}else {
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

const getMatchFiles = (fileMatches: string, baseDir: string) => {
	const options: IOptions = {
		cwd: baseDir
	};
	return globSync(fileMatches, options);
};

const getStashFiles = (fileMatches: string, baseDir: string) => {
	const result = execSync("git status -s", {cwd: baseDir});
	return result.toString().split(EOL).filter((path) => path !== "").map((path) => path.slice(3)).filter(filter(fileMatches));
};


const langs = [
	{lang: "en", suffixCode: ""},
	{lang: "th", suffixCode: "th"},
	{lang: "my", suffixCode: "my"},
	{lang: "id", suffixCode: "id"},
];

const doProcess = (filesMatches= "**/*.+(ts|tsx|js|jsx)", baseDir= cwd(), useGitStatusFiles= false) => {
	const files = (useGitStatusFiles ? getStashFiles(filesMatches, baseDir) : getMatchFiles(filesMatches, baseDir)).map((filePath) => join(baseDir, filePath));
	files.forEach((filePath) => {
		processSingleFile(filePath, langs);
	});
};

const argv = Yargs.usage("Usage: $0 [options]")
	.example("$0 -f **/*.+(ts|tsx|js|jsx) -d ./", "generate langs director / pot or po files.")
	.alias("f", "file matches")
	.describe("f", "Load File Matches Use minimatch style.")
	.alias("d", "search directory")
	.describe("f", "Search files from these directories.")
	.boolean("s")
	.alias("s", "use git status -s files")
	.describe("s", "Search files only in git status outputs.")
	.help("h")
	.alias("h", "help")
	.argv;

doProcess(argv.f, argv.d, argv.g);
