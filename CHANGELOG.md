# v1.4.0

* Removed required envFile, that can be optional now so if something is already set in our environment we can just 
  use that.

# v1.3.0

* Upgraded to Node.js v12 and all dependencies
* Upgraded max buffer size.

# v1.2.2

* Fix binary file (add missing shebang)

# v1.2.1

* Fix binary file (was not doing anything).

# v1.2.0

* Allow programmatic usage of `deployLambdaFunction`

# v1.1.1

* Fix for updating environment variables
  Was updating $LATEST, but updates were not applied to the published version.

# v1.1.0

* **Do not run `build` scripts**, specified in params.json
  You will need to run these on your own before deploying
* Log file size

# v1.0.1

* Pipe stdout from build commands to parent process

# v1.0.0

Initial release
