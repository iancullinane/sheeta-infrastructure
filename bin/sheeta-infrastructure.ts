#!/usr/bin/env node
import "source-map-support/register";
import * as fs from "fs";
import * as cdk from "aws-cdk-lib";

import { ConfigProps } from '../lib/sheeta-infrastructure-stack';
import { SheetaInfrastructureStack } from "../lib/sheeta-infrastructure-stack";

interface LocalConfig {
  account: string
  region: string
}

var lclCfg = JSON.parse(fs.readFileSync('config/local.json', 'utf-8')) as LocalConfig;
var projectConfig = JSON.parse(fs.readFileSync('config/base.json', 'utf-8')) as ConfigProps;

const envSheeta = { region: lclCfg.region, account: lclCfg.account };

const app = new cdk.App();


new SheetaInfrastructureStack(app, "Sheeta", {
  env: envSheeta,
  ...projectConfig
});
// app.synth;
