#!/usr/bin/env node
import { readFile, stat, writeFile } from 'fs/promises';
import { parse, stringify } from 'envfile';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import yargs from 'yargs';

const localServerUrl = 'http://localhost:3123';
const developmentEnvPath = '.env.development';
const localEnvFilePath = '.env.local';

const fileExists = (path) =>
  stat(path).then(
    () => true,
    () => false
  );
const args = yargs(hideBin(process.argv)).argv;

const localEnvFileExists = await fileExists(localEnvFilePath);
if (args.check && localEnvFileExists) process.exit(0);

const base = {
  ...((await fileExists(developmentEnvPath)) && parse(await readFile(developmentEnvPath))),
  ...(localEnvFileExists && parse(await readFile(localEnvFilePath)))
};

const { environment } = {
  ...args,
  ...(await inquirer.prompt(
    [
      {
        message: 'Choose an environment',
        name: 'environment',
        type: 'list',
        choices: [
          { name: 'Local', value: 'local' },
          { name: 'Development', value: 'development' },
          { name: 'Production', value: 'production' }
        ],
        default: 'local',
        describe: 'Environment',
        demandOption: true
      }
    ].filter((v) => !args[v.name])
  ))
};

const { baseurl } = {
  ...args,
  ...(await inquirer.prompt(
    [
      {
        message: 'Base URL',
        name: 'baseurl',
        type: 'input',
        default: '',
        describe: 'URL',
        demandOption: true
      }
    ].filter((v) => !args[v.name])
  ))
};

const { server } =
  (environment.toLowerCase() !== 'standalone' &&
    (await inquirer.prompt([
      {
        message: 'Server location?',
        name: 'server',
        type: 'input',
        default: localServerUrl,
        describe: 'Server',
        // validate: (v) => v.match(/^[a-z0-9]+$/i), // should return promise
        demandOption: true
      }
    ]))) ||
  {};

const data = {
  ...base,
  ...(environment.toLowerCase() !== 'standalone' && {
    BASE_URL: baseurl ?? '',
    VITE_SERVER: server
  }),
  ENVIRONMENT: environment
};

await writeFile(`.env.${environment}`, stringify(data));
