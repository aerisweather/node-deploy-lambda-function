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
async function deployLambdaFunction(params:IDeployParams) {
  // Remove devDependencies from lambda build, to save on space
  console.log('Removing devDependencies....');
  console.log('(keeping previous node_modules at /node_modules.bak, will restore later)');
  fs.copySync(
    path.join(process.cwd(), 'node_modules'),
    path.join(process.cwd(), 'node_modules.bak')
  );
  execSync('npm prune --production');
  console.log('Removing devDependencies... complete!');

  console.log('De-duping node_modules...');
  execSync('npm dedupe');
  console.log('De-duping node_modules... complete!');

  // Create the lambda function code
  console.log('Archiving lambda function code....');
  const archiveFile = path.join(process.cwd(), 'lambda-function.zip');
  await archive(params.srcDirs, archiveFile);
  const {size} = fs.statSync(archiveFile);
  const archiveSizeMb = size / (1024 * 1024);
  console.log(`Archiving lambda function code (${archiveSizeMb.toFixed(2)}MiB).... complete!`);

  // Restore previous node_modules
  console.log('Restoring previous node_modules...');
  fs.removeSync(path.join(process.cwd(), 'node_modules'));
  await moveDir(
    path.join(process.cwd(), 'node_modules.bak'),
    path.join(process.cwd(), 'node_modules')
  );
  console.log('Restoring previous node_modules... complete!');

  // Check that archive is less than 50MiB
  if (archiveSizeMb >= 50) {
    throw new Error(`Unable to deploy code to lambda: archive must be less than 50M (actually ${archiveSizeMb.toFixed(2)}MiB)`);
  }

  // Update the function code
  const lambda = new Lambda({ region: params.lambdaRegion || 'us-east-1' });
  console.log('Updating lambda function code...');
  await new Promise((onRes, onErr) => {
    lambda.updateFunctionCode({
      FunctionName: params.lambdaFunction,
      // We're going to wait to publish until AFTER config is updated.
      // otherwise, config will be applied to $LATEST, but not to our new version
      Publish: false,
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

  // Publish the new version
  console.log('Publishing...');
  const {Version} = await new Promise<Lambda.Types.FunctionConfiguration>((onRes, onErr) => {
    lambda.publishVersion({
      FunctionName: params.lambdaFunction
    }, (err, res) => err ? onErr(err) : onRes(res))
  });
  console.log(`Publishing version "${Version}"... complete!`);

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
}
export default deployLambdaFunction;


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


export interface IDeployParams {
  envFile: string; // location of .env file on s3
  srcDirs: string[];
  lambdaFunction: string;
  lambdaAlias: string;
  lambdaRole: string; // ARN for the iam role to associate with this lambda code version
  lambdaRegion?: string;
}