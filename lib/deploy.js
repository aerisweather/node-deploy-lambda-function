#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var loadS3Env_1 = require("./util/loadS3Env");
var path = require("path");
var child_process_1 = require("child_process");
var aws_sdk_1 = require("aws-sdk");
var fs = require("fs-extra");
/*
Update the function code, with a new version
Update the function configuration, with the new env vars
Point that prod/staging/dev alias at the new version
 */
var Cli = require('admiral-cli');
(function () { return __awaiter(_this, void 0, void 0, function () {
    var cli, params, archiveFile, size, sizeMb, lambda, Version, env;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cli = parseCliParams();
                params = require(cli.paramsFile);
                // Run tests and build
                console.log('Building and testing...');
                params.build.forEach(function (script) { return child_process_1.execSync(script); });
                console.log('Building and testing... complete!');
                // Remove devDependencies from lambda build, to save on space
                console.log('Removing devDependencies....');
                console.log('(keeping previous node_modules at /node_modules.bak, will restore later)');
                fs.copySync(path.join(process.cwd(), 'node_modules'), path.join(process.cwd(), 'node_modules.bak'));
                child_process_1.execSync('npm prune --production');
                console.log('Removing devDependencies... complete!');
                // Create the lambda function code
                console.log('Archiving lambda function code....');
                archiveFile = path.join(process.cwd(), 'lambda-function.zip');
                return [4 /*yield*/, archive(params.srcDirs, archiveFile)];
            case 1:
                _a.sent();
                size = fs.statSync(archiveFile).size;
                sizeMb = size / (1024 * 1024);
                console.log("Archiving lambda function code (" + sizeMb.toFixed(2) + "M).... complete!");
                // Restore previous node_modules
                console.log('Restoring previous node_modules...');
                fs.removeSync(path.join(process.cwd(), 'node_modules'));
                return [4 /*yield*/, moveDir(path.join(process.cwd(), 'node_modules.bak'), path.join(process.cwd(), 'node_modules'))];
            case 2:
                _a.sent();
                console.log('Restoring previous node_modules... complete!');
                lambda = new aws_sdk_1.Lambda({ region: params.lambdaRegion || 'us-east-1' });
                // Update the function code
                console.log('Updating lambda function code...');
                return [4 /*yield*/, new Promise(function (onRes, onErr) {
                        lambda.updateFunctionCode({
                            FunctionName: params.lambdaFunction,
                            Publish: true,
                            ZipFile: fs.readFileSync(archiveFile)
                        }, function (err, data) { return err ? onErr(err) : onRes(data); });
                    })];
            case 3:
                Version = (_a.sent()).Version;
                fs.removeSync(archiveFile);
                console.log('Updating lambda function code... complete!');
                // Grab the env vars from s3
                // And update the function config
                console.log('Updating function configuration...');
                return [4 /*yield*/, loadS3Env_1.default(params.envFile)];
            case 4:
                env = _a.sent();
                return [4 /*yield*/, new Promise(function (onRes, onErr) {
                        lambda.updateFunctionConfiguration({
                            FunctionName: params.lambdaFunction,
                            Environment: {
                                Variables: env
                            },
                            Role: params.lambdaRole
                        }, function (err) { return err ? onErr(err) : onRes(); });
                    })];
            case 5:
                _a.sent();
                console.log('Updating function configuration... complete!');
                // Update the alias to point at our new version
                console.log("Pointing " + params.lambdaAlias + " --> " + Version + "...");
                return [4 /*yield*/, new Promise(function (onRes, onErr) {
                        lambda.updateAlias({
                            FunctionName: params.lambdaFunction,
                            FunctionVersion: Version,
                            Name: params.lambdaAlias
                        }, function (err) { return err ? onErr(err) : onRes(); });
                    })];
            case 6:
                _a.sent();
                console.log("Pointing " + params.lambdaAlias + " --> " + Version + "... complete!");
                return [2 /*return*/];
        }
    });
}); })()
    .catch(function (err) {
    console.error(err.stack);
    process.exit(1);
});
function moveDir(src, dst) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (onRes, onErr) {
                        fs.move(src, dst, function (err) { return err ? onErr(err) : onRes(); });
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function archive(srcDirs, destFile) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            child_process_1.execSync("zip -r -9 " + destFile + " " + srcDirs.join(' '), {
                cwd: process.cwd()
            });
            return [2 /*return*/];
        });
    });
}
function parseCliParams() {
    var cli = new Cli()
        .option({
        name: 'paramsFile',
        description: 'Location of params.json file',
        type: 'path',
        shortFlag: '-c',
        longFlag: '--config',
        length: 1,
        required: true
    });
    return cli.parse();
}
//# sourceMappingURL=deploy.js.map