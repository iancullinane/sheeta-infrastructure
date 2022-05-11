import { Stack, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { v4 as uuidv4 } from "uuid";

import { NestedResourceStack } from "./nested-stacks/resources";
// example with go bundling
// https://faun.pub/golang-build-and-deploy-an-aws-lambda-using-cdk-b484fe99304b

export interface ConfigProps extends cdk.StackProps {
  projectName: string,
  appSha: string,
  domainName: string,
  subDomain: string,
  certName: string,
  account: string,
  repoName: string,
}

export class SheetaInfrastructureStack extends Stack {

  declare sha: string;

  constructor(scope: Construct, id: string, props: ConfigProps) {
    super(scope, id, props);

    this.sha = props.appSha;

    // This will return a NestedStack with various resources, using a Nested
    // Stack lets us change the underlying resources and re-deploy into
    // another environment
    const { cert, hz, repo } = new NestedResourceStack(
      this, "resource-stack", { ...props }
    );

    const dn = new apigwv2.DomainName(this, "DN", {
      domainName: `${props.domainName}`,
      certificate: acm.Certificate.fromCertificateArn(this, "cert", cert.certificateArn),
    });

    //
    // ---- Lambda and the container

    // Drone builds and tags from the lambda base image, "requires" a AWS
    // provided image to build easily

    const sheetaLambdaRole = new iam.Role(this, "sheeta-execution-role", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    sheetaLambdaRole.grant(
      new iam.ServicePrincipal("lambda.amazonaws.com"),
      "sts:AssumeRole"
    );
    sheetaLambdaRole.grant(sheetaLambdaRole, "ssm:Describe*", "ssm:GetParam*");
    sheetaLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "client-policies", {
        statements: [
          new iam.PolicyStatement({
            actions: ["cloudformation:*"],
            resources: ["*"],
          }),
          new iam.PolicyStatement({
            actions: ["ec2:*"],
            resources: ["*"],
            conditions: {
              'ForAllValues:StringEquals': {
                'aws:TagKeys': ["sheeta"]
              }
            }
          }),
          new iam.PolicyStatement({
            actions: ["s3:*"],
            resources: ["*"],
            conditions: {
              'ForAllValues:StringEquals': {
                'aws:TagKeys': ["sheeta"]
              }
            }
          }),
        ]
      })
    )
    sheetaLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "ssm-get-policy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["ssm:Describe*", "ssm:GetParam*"],
            resources: [`arn:aws:ssm:us-east-2:${props.account}:parameter/*`],
          }),
        ],
      })
    );

    // these two only required if your function lives in a VPC
    sheetaLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );
    sheetaLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole"
      )
    );

    const sheetaLambda = new lambda.DockerImageFunction(this, `ECRFunction-${props.domainName}`, {
      role: sheetaLambdaRole,
      timeout: cdk.Duration.minutes(5),
      environment: {
        CodeVersionString: this.sha,
      },
      code: lambda.DockerImageCode.fromEcr(repo, {
        tag: this.sha,
      }),
    });

    const sheetaIntegration = new HttpLambdaIntegration(
      "sheetaIntergration",
      sheetaLambda
    );

    // requires the apigateway created above
    // uses the experimental branch, pins to its own version outsid of cdk lib
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-apigatewayv2-alpha-readme.html
    const api = new apigwv2.HttpApi(this, "Sheeta", {
      defaultDomainMapping: {
        domainName: dn,
      },
    });

    api.addRoutes({
      path: "/v1/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: sheetaIntegration,
    });

    // //
    // // ------ Networking
    new r53.ARecord(this, `ARecord-${props.subDomain}.${props.domainName}.`, {
      zone: hz,
      target: r53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          dn.regionalDomainName,
          dn.regionalHostedZoneId
        )
      ),
    });


  }
}

