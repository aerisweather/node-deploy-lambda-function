#!/usr/bin/env node
const deployLambdaFunction = require('@aerisweather/deploy-lambda-function').default;
const Cli = require('admiral-cli');

// Parse the config
const paramsFile = new Cli()
  .option({
    name: 'paramsFile',
    description: 'Location of params.json file',
    type: 'path',
    shortFlag: '-c',
    longFlag: '--config',
    length: 1,
    required: true
  })
  .parse()
  .paramsFile;

const params = require(paramsFile);

deployLambdaFunction(params)
  .then(
    () => process.exit(0),
    (err) => {
        console.error(err.stack);
        process.exit(1);
    }
  );

