import { execSync } from "child_process";
import { access, constants, readFileSync, writeFileSync, readdirSync, createReadStream, createWriteStream, statSync } from "fs";
import { dirname, basename, join, extname, sep, resolve } from "path";
import { sync as mkdirpSync } from "mkdirp";
import { sync as globSync } from "glob";
import { cwd } from "process";
import * as Yargs from "yargs";
import { green } from "colors";
import { sync as rmSync } from "rimraf";

const defaultLangs = ["en", "th", "ms", "id"];

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

const genPoFiles = (inputFilePaths: string | string[], potFilePath: string, langs: string[]) => {
	const potDirName = dirname(potFilePath);
	const filename = basename(potFilePath, extname(potFilePath));
	const filePaths = typeof inputFilePaths === "string" ? inputFilePaths : inputFilePaths.join(" ");
	execOnlyErrorOutput(`xgettext --language=JavaScript --add-comments --sort-output --from-code=UTF-8 --no-location --msgid-bugs-address=wanglin@ezbuy.com -o ${potFilePath} ${filePaths}`);

	checkFileExists(potFilePath).then((ifPotFileExists) => {
		if (ifPotFileExists) {
			console.log(green(potFilePath));
			writeFileSync(potFilePath, readFileSync(potFilePath).toString().replace("charset=CHARSET", "charset=UTF-8"));
			langs.forEach((lang) => {
				const poFilePath = join(potDirName, `${filename}${lang === "" ? "" : `.${lang}` }.po`);
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
			genPoFiles(filePath, potFilePath, langs);
			if (readdirSync(poFileDir).length === 0) {
				rmSync(poFileDir);
			}
		}
	}).catch((e) => {
		console.error(e);
	});
};

const getMatchFiles = (fileMatches: string, files: string[]) => {
	return files.reduce<string[]>((pValue, cValue) => {
		const currentPath = resolve(cValue);
		if (statSync(resolve(currentPath)).isDirectory()) {
			return [...pValue, ...globSync(fileMatches, {cwd: currentPath}).map((path) => (join(currentPath, path)))];
		}
		return [...pValue, resolve(cValue)];
	}, []);
};

const doGenLangs = (filesMatches= "**/*.+(ts|tsx|js|jsx)", inputFiles= [cwd()], langs= defaultLangs, specialFile?: string) => {
	const files = getMatchFiles(filesMatches, inputFiles);
	if (typeof specialFile === "undefined") {
		files.forEach((filePath) => {
			processSingleFile(filePath, langs);
		});
	} else {
		specialFile = resolve(specialFile);
		mkdirpSync(dirname(specialFile));
		genPoFiles(files, resolve(specialFile), langs);
	}
};

const copySingleFile = (srcFilePath: string, destFilePath: string) => {
	createReadStream(srcFilePath).pipe(createWriteStream(destFilePath));
};

const doPackLangs = (output: string, baseDir= cwd(), langs= defaultLangs) => {
	const poFiles =  globSync(`**/langs/*.+(${langs.join("|")}).po`, {cwd: baseDir});
	const outDirAlreadyCreated: {[key: string]: boolean} = {};

	poFiles.forEach((path) => {
		const srcFilename = join(baseDir, path);
		const destDirname = dirname(path).split(sep).reverse().join(".");
		const outDirPath = join(resolve(output), destDirname);
		if (!outDirAlreadyCreated[outDirPath]) {
			outDirAlreadyCreated[outDirPath] = true;
			mkdirpSync(outDirPath);
		}
		copySingleFile(srcFilename, join(outDirPath, basename(path)));
		console.log(`[copy] ${green(srcFilename)} to ${green(destDirname)}`);
	});
};

const doRepackLangs = (input: string, baseDir= cwd(), langs= defaultLangs) => {
	const inputBase = resolve(input);
	const dirs = readdirSync(inputBase);
	dirs.forEach((dirName) => {
		const poFiles = globSync(`*.+(${langs.join("|")}).po`, {cwd: join(inputBase, dirName)});
		if (poFiles.length > 0) {
			const resultDirPath = join(baseDir, ...dirName.split(".").reverse());
			mkdirpSync(resultDirPath);
			poFiles.forEach((filename) => {
				const destFilename = join(resultDirPath, filename);
				copySingleFile(join(inputBase, dirName, filename), destFilename);
				console.log(`[copy] ${green(join(dirName, filename))} to ${green(destFilename)}`);
			});
		}
	});
};

Yargs.usage("Usage: [command] $0 [options]")
	.example("$0 gen -f **/*.+(ts|tsx|js|jsx) -d ./", "generate langs director / pot or po files.")
	.alias("d", "search directory")
	.describe("d", "Search files from the directory.")
	.array("l")
	.alias("l", "generate locales default is en th my id")
	.command("gen", "generate language files for special path", (yargs) => {
		return yargs
				.array("i")
				.alias("i", "input files")
				.describe("i", "Files or Directories to generate po files")
				.alias("f", "file matches")
				.describe("f", "Load File Matches Use minimatch style")
				.alias("s", "special file")
				.describe("s", "A Path to the special pot file")
				.argv;
	}, (argv) => {
		doGenLangs(argv.f, argv.i, argv.l, argv.s);
	})
	.command("pack", "get langs pack from source code", (yargs) => {
		return yargs
				.alias("o", "output")
				.describe("o", "output path")
				.demandOption(["o"])
				.argv;
	}, (argv) => {
		doPackLangs(argv.o, argv.d, argv.l);
	})
	.command("repack", "put langs pack to source code", (yargs) => {
		return yargs
				.alias("i", "input")
				.describe("i", "input path")
				.demandOption(["i"])
				.argv;
	}, (argv) => {
		doRepackLangs(argv.i, argv.d, argv.l);
	})
	.argv;

