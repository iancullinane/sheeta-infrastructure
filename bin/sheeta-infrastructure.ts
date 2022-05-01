#!/usr/bin/env node
import "source-map-support/register";
import * as fs from "fs";
import * as cdk from "aws-cdk-lib";

import { ConfigProps } from '../lib/sheeta-infrastructure-stack';
import { SheetaInfrastructureStack } from "../lib/sheeta-infrastructure-stack";

interface LocalConfig {
  account: string
}

var projectConfig = JSON.parse(fs.readFileSync('config/base.json', 'utf-8')) as ConfigProps;
var lclCfg = JSON.parse(fs.readFileSync('config/local.json', 'utf-8')) as LocalConfig;

const envSheeta = { region: "us-east-2", account: lclCfg.account };

const app = new cdk.App();
new SheetaInfrastructureStack(app, "Sheeta2", {
  env: envSheeta,
  ...projectConfig
});
app.synth;
