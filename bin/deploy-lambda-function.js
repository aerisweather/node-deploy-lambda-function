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

