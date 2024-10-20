import fs, { writeFileSync } from 'fs';
import os from 'os';
import path, { join } from 'path';
import AdmZip from 'adm-zip';
import minimist from 'minimist';
import prompts from 'prompts';
import { red, reset, yellow } from 'kolorist';
import axios from 'axios';
import { simpleGit } from 'simple-git';
import proc from 'child_process';
import which from 'which';
import { NodeProject } from './config/projects/node';
import { load } from 'js-yaml';
import { AbstractProject } from './config/projects';
import { GolangProject } from './config/projects/golang';
import { DotnetProject } from './config/projects/dotnet';
import { PythonProject } from './config/projects/python';
import { RustProject } from './config/projects/rust';
import ejs from 'ejs';

const argv = minimist<{
  t?: string;
  template?: string;
}>(process.argv.slice(2), { string: ['_'] });
const cwd = process.cwd();

type ColorFunc = (str: string | number) => string;

type DisplayedFrameworkVariant = FrameworkVariant & {
  display: string;
  color: ColorFunc;
};

type Framework = {
  repo: string;
  display: string;
  color: ColorFunc;
  variants: DisplayedFrameworkVariant[];
  downloadUrl: string;
};

type ProjectType = 'dotnet' | 'go' | 'node' | 'python' | 'rust';

type Choice = {
  projectName: string;
  framework: Framework;
  variant: string;
  overwrite?: 'yes';
  packageName: string;
};

type FrameworkVariant = {
  branch?: string;
  projectFile?: string;
  configFile?: string;
  type?: ProjectType;
  rm?: string[];
  handler?: string;
  main?: string;
  devCommand?: string;
};

type Index = {
  Frameworks: {
    [language: string]: {
      [variant: string]: FrameworkVariant;
    };
  };
};

const fetchFrameworks = async (): Promise<Framework[]> => {
  const { data: indexYaml } = await axios.get(
    'https://raw.githubusercontent.com/scaffoldly/scaffoldly-examples/refs/heads/main/index.yml',
  );

  const index = load(indexYaml) as Index;

  const frameworks = Object.entries(index.Frameworks).reduce((acc, [language, variants]) => {
    acc.push({
      display: language,
      downloadUrl: 'https://codeload.github.com/scaffoldly',
      repo: 'scaffoldly-examples',
      color: yellow,
      variants: Object.entries(variants).reduce((accV, [variant, frameworkVariant]) => {
        accV.push({
          ...frameworkVariant,
          display: variant,
          color: yellow,
        });
        return accV;
      }, [] as DisplayedFrameworkVariant[]),
    });
    return acc;
  }, [] as Framework[]);

  return frameworks;
};

const generateReadme = async (variant: FrameworkVariant): Promise<string> => {
  const { data: readmeTemplate } = await axios.get(
    'https://raw.githubusercontent.com/scaffoldly/scaffoldly-examples/refs/heads/main/.templates/csa/README.md.tpl',
  );

  return ejs.render(readmeTemplate, variant, { async: true });
};

function templates(frameworks: Framework[]) {
  return frameworks
    .map((f) => (f.variants && f.variants.map((v) => v.branch)) || [f.repo])
    .reduce((a, b) => a.concat(b), []);
}

function getVariant(frameworks: Framework[], branch: string): FrameworkVariant | undefined {
  for (const framework of frameworks) {
    const variant = framework.variants.find((v) => v.branch === branch);
    if (variant) {
      return variant;
    }
  }
  return undefined;
}

const renameFiles: Record<string, string | undefined> = {
  _gitignore: '.gitignore',
};

const defaultTargetDir = 'my-app';

const exec = async (workingDirectory: string, args: string[]): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const env = {
      ...process.env,
    };

    let command: string;
    try {
      command = which.sync(args[0]);
    } catch (e) {
      reject(new Error(`Unable to locate the \`${args[0]}\` command on this system.`));
      return;
    }

    const p = proc.spawn(`"${command}"`, args.slice(1), {
      cwd: workingDirectory,
      shell: true,
      env,
    });

    p.on('error', (err) => {
      console.error(err);
      reject(err);
    });

    p.on('exit', () => {
      resolve();
    });

    p.stdin.pipe(process.stdin);
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
  });
};

function formatTargetDir(targetDir: string | undefined) {
  return targetDir?.trim().replace(/\/+$/g, '');
}

function isEmpty(filePath: string) {
  const files = fs.readdirSync(filePath);
  return files.length === 0 || (files.length === 1 && files[0] === '.git');
}

function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(projectName);
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-');
}

function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const file of fs.readdirSync(dir)) {
    if (file === '.git') {
      continue;
    }
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true });
  }
}

async function downloadAndExtractZip(framework: Framework, branch: string): Promise<string> {
  const { downloadUrl, repo } = framework;

  const url = new URL(`${downloadUrl}/${repo}/zip/refs/heads/${branch}`);

  console.log(``);
  console.log(`Downloading template from the \`${branch}\` branch from \`${repo}\`...`);
  console.log(``);

  try {
    const response = await axios({
      method: 'get',
      url: url.toString(),
      responseType: 'arraybuffer',
    });

    const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'template-'));
    const tempFileName = url.pathname.split('/').pop();

    if (!tempFileName) {
      throw new Error(`Error extracting ZIP file: ${url}`);
    }

    const tempZipPath = path.join(tempDirPath, tempFileName);
    fs.writeFileSync(tempZipPath, response.data);

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(tempDirPath, true);

    fs.unlinkSync(tempZipPath);

    return path.join(tempDirPath, `${repo}-${branch}`);
  } catch (error) {
    throw new Error(`Error downloading or extracting ZIP file: ${error}`);
  }
}

function copy(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      const srcFile = path.resolve(src, file);
      const destFile = path.resolve(dest, file);
      copy(srcFile, destFile);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function sanitize(filename: string, startMarker: string, endMarker: string) {
  const text = fs.readFileSync(filename, 'utf-8');
  const lines = text.split('\n');
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startMarker)) {
      startLine = i;
    } else if (lines[i].includes(endMarker)) {
      endLine = i;
      break;
    }
  }

  if (startLine !== -1 && endLine !== -1) {
    lines.splice(startLine, endLine - startLine + 1);
  }

  fs.writeFileSync(filename, lines.join('\n'), { encoding: 'utf-8' });
}

const getProject = (projectType: ProjectType, workdir: string): AbstractProject | undefined => {
  switch (projectType) {
    case 'node':
      return new NodeProject(undefined, workdir);
    case 'go':
      return new GolangProject(undefined, workdir);
    case 'dotnet':
      return new DotnetProject(undefined, workdir);
    case 'python':
      return new PythonProject(undefined, workdir);
    case 'rust':
      return new RustProject(undefined, workdir);
    default:
      return undefined;
  }
};

export const run = async (): Promise<void> => {
  const frameworks = await fetchFrameworks();

  const argTargetDir = formatTargetDir(argv._[0]);
  const argTemplate = argv.template || argv.t;

  let targetDir = argTargetDir || defaultTargetDir;
  const getProjectName = () => (targetDir === '.' ? path.basename(path.resolve()) : targetDir);

  let result: prompts.Answers<
    'projectName' | 'overwrite' | 'packageName' | 'framework' | 'variant'
  >;

  prompts.override({
    overwrite: argv.overwrite,
  });

  try {
    result = await prompts(
      [
        {
          type: argTargetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultTargetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir;
          },
        },
        {
          type: () => (!fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'select'),
          name: 'overwrite',
          message: () =>
            (targetDir === '.' ? 'Current directory' : `Target directory "${targetDir}"`) +
            ` is not empty. Please choose how to proceed:`,
          initial: 0,
          choices: [
            {
              title: 'Remove existing files and continue',
              value: 'yes',
            },
            {
              title: 'Cancel operation',
              value: 'no',
            },
            {
              title: 'Ignore files and continue',
              value: 'ignore',
            },
          ],
        },
        {
          type: (_, { overwrite }: { overwrite?: string }) => {
            if (overwrite === 'no') {
              throw new Error(red('✖') + ' Operation cancelled');
            }
            return null;
          },
          name: 'overwriteChecker',
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) => isValidPackageName(dir) || 'Invalid name',
        },
        {
          type: argTemplate && templates(frameworks).includes(argTemplate) ? null : 'select',
          name: 'framework',
          message:
            typeof argTemplate === 'string' && !templates(frameworks).includes(argTemplate)
              ? reset(`"${argTemplate}" isn't a valid template. Please choose from below: `)
              : reset('Select a framework:'),
          initial: 0,
          choices: frameworks.map((framework) => {
            const frameworkColor = framework.color;
            return {
              title: frameworkColor(framework.display || framework.repo),
              value: framework,
            };
          }),
        },
        {
          type: (framework: Framework) => (framework && framework.variants ? 'select' : null),
          name: 'variant',
          message: reset('Select a variant:'),
          choices: (framework: Framework) =>
            framework.variants.map((variant) => {
              const variantColor = variant.color;
              return {
                title: variantColor(variant.display),
                value: variant.branch,
              };
            }),
        },
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled');
        },
      },
    );
  } catch (cancelled) {
    console.log(cancelled.message);
    return;
  }

  // user choice associated with prompts
  const { framework, overwrite, packageName, variant: branch } = result as Choice;
  const variant = getVariant(frameworks, branch);

  if (!variant) {
    throw new Error(`Invalid variant: ${branch}`);
  }

  const { rm: excludeFiles, type } = variant;

  if (!type) {
    throw new Error(`Invalid project type: ${type}`);
  }

  const root = path.join(cwd, targetDir);

  if (overwrite === 'yes') {
    emptyDir(root);
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  console.log(`\nCreating project in ${root}...`);

  const templateDir = await downloadAndExtractZip(framework, branch);

  const write = (file: string, content?: string) => {
    const targetPath = path.join(root, renameFiles[file] ?? file);
    if (content) {
      fs.writeFileSync(targetPath, content);
    } else {
      copy(path.join(templateDir, file), targetPath);
    }
  };

  const files = fs.readdirSync(templateDir);
  for (const file of files.filter(
    (f) =>
      f !== 'README.md' &&
      f !== 'LICENSE' &&
      f !== 'LICENSE.md' &&
      excludeFiles &&
      !excludeFiles.includes(f),
  )) {
    write(file);
  }

  const project = getProject(type, templateDir);
  if (!project) {
    throw new Error(`Invalid project type: ${variant.type}`);
  }

  await project.setProject(packageName || getProjectName());
  writeFileSync(path.join(root, 'README.md'), await generateReadme(variant));

  sanitize(path.join(root, '.gitignore'), '### +CSA-OMIT ###', '### -CSA-OMIT ###');

  const installCommands = await project.installCommands;
  if (installCommands) {
    await Promise.all(
      installCommands.commands.map((command) => {
        const workingDirectory = join(root, command.workdir || '.');
        console.log(`Installing dependencies using \`${command.cmd}\` in ${workingDirectory}...`);
        return exec(workingDirectory, command.cmd.split(' '));
      }),
    );
  }

  console.log(`Initializing git in ${root}...`);
  const git = simpleGit(root);
  await git.init({ '--initial-branch': 'main' });
  await git.add('.');
  await git.commit('[csa] Initial commit');

  const cdProjectName = path.relative(cwd, root);
  console.log(`\n`);
  console.log(`Done.`);
  console.log(`\n`);
  if (root !== cwd) {
    console.log(`First, change into the project's directory by running:`);
    console.log(``);
    console.log(`    cd ${cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName}`);
    console.log(``);
  }

  console.log(`Next, push this repository to GitHub:`);
  console.log(``);
  console.log(`    1) Create a new repository on GitHub`);
  console.log(`    2) Run: \`git remote add origin <repository-url>\``);
  console.log(`    3) Run: \`git push -u origin main\``);
  console.log(``);
  console.log(`✨ And begin development on your project like normal!`);
  console.log(``);
  console.log(`Once you're ready to deploy to AWS:`);
  console.log(`    Run: \`npx scaffoldly deploy\``);
  console.log(`    and scaffoldly will build and deploy your application to AWS.`);
  console.log(``);
  console.log(`See our documentation at https://scaffoldly.dev/docs`);
  console.log(``);
  console.log(`🚀 Happy coding, and thanks for using Scaffoldly!`);
  console.log(``);
};
