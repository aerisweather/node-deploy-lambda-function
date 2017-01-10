# deploy-lambda-function

Helper for deploying code to AWS Lambda.

## What does it do

* **Packages** your code into a `zip` file (excludes devDependencies, to keep it small)
* **Uploads* your code to a lambda function
* Loads **env vars from S3**, and applies them to your new lambda function version
* Sets the **IAM role** of your new lambda function version
* Points an **alias** at your new lambda function version

## Usage

First, you'll need to setup a `param.json` config files for each deployment environment. For example:

```javascript
// params.staging.json
{
  // List of directories to include in `zip` file
  "srcDirs": ["dist/lib", "node_modules"],
  // Name of your lambda function on AWS
  "lambdaFunction": "my-lambda-function",
  // Location of environment variables on S3
  "envFile": "s3://my-bucket/env/staging.env",
  // The alias you want to point at your lambda function
  "lambdaAlias": "staging",
  // The IAM role you want to give your lambda function
  "lambdaRole": "arn:aws:iam::ACCOUNT_ID:role/my-lambda-function-staging",
  // The region associated with your lambda function (optional)
  "lambdaRegion": "us-east-1"
}
```

To deploy to that environment, run:

```
node_modules/.bin/deploy-lambda-function -c ./params.staging.json
```


## Example: BitBucket Pipelines

You can setup BitBucket pipelines to deploy to lambda, using `deploy-lambda-function`.

For this to work, you'll need to:

* Create `params.json` files for `prod`, `staging`, and `dev`
* Add the `bitbucket-pipelines.yml` file below to your repo


```yaml
# bitbucket-pipelines.yml

# Run on LambCI's lambda-simulation container,
# to give an environment that's close to the real deal
image: lambci/nodejs4.3

clone:
  depth: 1

pipelines:
  # Default build scripts...
  default:
    - step:
        script:
          # Login to NPM
          - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
          - npm install
          - npm run build
          - npm run test

  # master/staging/development get deployed to lambda
  branches:
    master:
      - step:
          script:
            - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
            - npm install
            - ./node_modules/.bin/deploy-lambda-function -c ./deploy/params.prod.json
    staging:
      - step:
          script:
            - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
            - npm install
            - ./node_modules/.bin/deploy-lambda-function -c ./deploy/params.staging.json
    development:
      - step:
          script:
            - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
            - npm install
            - ./node_modules/.bin/deploy-lambda-function -c ./deploy/params.dev.json
```

* Create an IAM user for Pipelines, with an IAM policy like so

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Stmt1483740194000",
            "Effect": "Allow",
            "Action": [
                "lambda:PublishVersion",
                "lambda:UpdateAlias",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration"
            ],
            "Resource": [
                "arn:aws:lambda:ACCOUNT_REGION:ACCOUNT_ID:function:NAME_OF_YOUR_LAMBDA_FUNCTION"
            ]
        }
    ]
}
```

* Assign the IAM role to an IAM user
* Provide IAM user credentials to Pipelines, via env vars
* Provide npm credentials to bit Pipelines, by copying the token from your local `~/.npmrc` to the `NPM_TOKEN` env var in Pipelines