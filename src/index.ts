import { execSync } from "child_process";
import { access, constants, readFileSync, writeFileSync, readdirSync, createReadStream, createWriteStream } from "fs";
import { dirname, basename, join, extname, sep } from "path";
import { sync as mkdirpSync } from "mkdirp";
import { sync as globSync, IOptions } from "glob";
import { cwd } from "process";
import * as Yargs from "yargs";
import { green } from "colors";
import { filter } from "minimatch";
import { EOL } from "os";
import * as rimraf from "rimraf";

const defaultLangs = ["en", "th", "my", "id"];

const checkFileExists = (filePath: string) => {
	return new Promise((resolve) => {
		access(filePath, constants.F_OK, (err) => {
			if (err) {
				resolve(false);
			}
			resolve(true);
		});
	});
};

const execOnlyErrorOutput = (command: string) => {
	execSync(command, {stdio: ["ignore", "ignore", "pipe"]});
};

const processSingleFile = (filePath: string, langs: string[]) => {
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
					langs.forEach((lang) => {
						const poFilePath = join(poFileDir, `${filename}${lang === "" ? "" : `.${lang}` }.po`);
						checkFileExists(poFilePath).then((ifExists) => {
							if (ifExists) {
								execOnlyErrorOutput(`msgmerge --output-file=${poFilePath} ${poFilePath} ${potFilePath}`);
							}else {
								execOnlyErrorOutput(`msginit --no-translator --input=${potFilePath} --locale=${lang} --output=${poFilePath}`);
							}
						});
					});
				}else {
					if (readdirSync(poFileDir).length === 0) {
						rimraf.sync(poFileDir);
					}
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

const doGenLangs = (filesMatches= "**/*.+(ts|tsx|js|jsx)", baseDir= cwd(), useGitStatusFiles= false, langs= defaultLangs) => {
	const files = (useGitStatusFiles ? getStashFiles(filesMatches, baseDir) : getMatchFiles(filesMatches, baseDir)).map((filePath) => join(baseDir, filePath));
	files.forEach((filePath) => {
		processSingleFile(filePath, langs);
	});
};

const doPackLangs = (output: string, baseDir= cwd(), langs = defaultLangs) => {
	const poFiles =  globSync(`**/langs/*.+(${langs.join("|")}).po`, {cwd: baseDir});
	const outDirAlreadyCreated: {[key: string]: boolean} = {};

	poFiles.forEach((path) => {
		const outDirPath = join(baseDir, output, dirname(path).split(sep).reverse().join("."));
		if (!outDirAlreadyCreated[outDirPath]) {
			outDirAlreadyCreated[outDirPath] = true;
			mkdirpSync(outDirPath);
		}
		createReadStream(join(baseDir, path)).pipe(createWriteStream(join(outDirPath, basename(path))));
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

