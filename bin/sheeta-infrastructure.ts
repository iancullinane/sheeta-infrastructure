#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { SheetaInfrastructureStack } from "../lib/sheeta-infrastructure-stack";

const app = new cdk.App();
new SheetaInfrastructureStack(app, "SheetaInfrastructureStack", {
  env: {
    region: "us-east-1",
    account: "...",
  },
});
app.synth;
