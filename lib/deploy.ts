#!/usr/bin/env node
import loadS3Env from './util/loadS3Env';
import * as path from 'path';
import {execSync} from 'child_process';
import {Lambda} from 'aws-sdk';
import * as fs from 'fs-extra';

/*
Update the function code, with a new version
Update the function configuration, with the new env vars
Point that prod/staging/dev alias at the new version
 */

const Cli = <any>require('admiral-cli');

(async () => {
  // Parse the config
  const cli = parseCliParams();
  const params = require(cli.paramsFile) as IDeployParams;

  // Run tests and build
  console.log('Building and testing...');
  params.build.forEach(script => execSync(script));
  console.log('Building and testing... complete!');

  // Remove devDependencies from lambda build, to save on space
  console.log('Removing devDependencies....');
  console.log('(keeping previous node_modules at /node_modules.bak, will restore later)');
  fs.copySync(
    path.join(process.cwd(), 'node_modules'),
    path.join(process.cwd(), 'node_modules.bak')
  );
  execSync('npm prune --production');
  console.log('Removing devDependencies... complete!');

  // Create the lambda function code
  console.log('Archiving lambda function code....');
  const archiveFile = path.join(process.cwd(), 'lambda-function.zip');
  await archive(params.srcDirs, archiveFile);
  const {size} = fs.statSync(archiveFile);
  const sizeMb = size / (1024 * 1024);
  console.log(`Archiving lambda function code (${sizeMb.toFixed(2)}M).... complete!`);

  // Restore previous node_modules
  console.log('Restoring previous node_modules...');
  fs.removeSync(path.join(process.cwd(), 'node_modules'));
  await moveDir(
    path.join(process.cwd(), 'node_modules.bak'),
    path.join(process.cwd(), 'node_modules')
  );
  console.log('Restoring previous node_modules... complete!');

  const lambda = new Lambda({ region: params.lambdaRegion || 'us-east-1' });

  // Update the function code
  console.log('Updating lambda function code...');
  const {Version} = await new Promise<Lambda.Types.FunctionConfiguration>((onRes, onErr) => {
    lambda.updateFunctionCode({
      FunctionName: params.lambdaFunction,
      Publish: true,
      ZipFile: fs.readFileSync(archiveFile)
    }, (err, data) => err ? onErr(err) : onRes(data));
  });
  fs.removeSync(archiveFile);
  console.log('Updating lambda function code... complete!');

  // Grab the env vars from s3
  // And update the function config
  console.log('Updating function configuration...');
  const env:any = await loadS3Env(params.envFile);
  await new Promise((onRes, onErr) => {
    lambda.updateFunctionConfiguration({
      FunctionName: params.lambdaFunction,
      Environment: {
        Variables: env
      },
      Role: params.lambdaRole
    }, err => err ? onErr(err) : onRes());
  });
  console.log('Updating function configuration... complete!');

  // Update the alias to point at our new version
  console.log(`Pointing ${params.lambdaAlias} --> ${Version}...`);
  await new Promise((onRes, onErr) => {
    lambda.updateAlias({
      FunctionName: params.lambdaFunction,
      FunctionVersion: Version,
      Name: params.lambdaAlias
    }, err => err ? onErr(err) : onRes());
  });
  console.log(`Pointing ${params.lambdaAlias} --> ${Version}... complete!`);
})()
  .catch(err => {
    console.error(err.stack);
    process.exit(1)
  });

async function moveDir(src:string, dst:string) {
  await new Promise((onRes, onErr) => {
    fs.move(src, dst, err => err ? onErr(err) : onRes())
  });
}

async function archive(srcDirs:string[], destFile:string) {
  execSync(`zip -r -9 ${destFile} ${srcDirs.join(' ')}`, {
    cwd: process.cwd()
  });
}

function parseCliParams(): ICliParams {
  const cli = new Cli()
    .option({
      name: 'paramsFile',
      description: 'Location of params.json file',
      type: 'path',
      shortFlag: '-c',
      longFlag: '--config',
      length: 1,
      required: true
    });

  return cli.parse() as ICliParams;
}

interface IDeployParams {
  envFile: string; // location of .env file on s3
  srcDirs: string[];
  lambdaFunction: string;
  lambdaAlias: string;
  lambdaRole: string; // ARN for the iam role to associate with this lambda code version
  lambdaRegion?: string;
  build: string[];  // build scripts to run, before deploying
}

interface ICliParams {
  paramsFile: string;
}