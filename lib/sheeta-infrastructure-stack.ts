import { Stack, StackProps } from "aws-cdk-lib";
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

// example with go bundling
// https://faun.pub/golang-build-and-deploy-an-aws-lambda-using-cdk-b484fe99304b

export class SheetaInfrastructureStack extends Stack {
  declare api: apigwv2.HttpApi;
  declare handler: lambda.Function;
  declare sha: string;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // const discordParam =
    //   ssm.StringParameter.fromSecureStringParameterAttributes(
    //     this,
    //     "some-param",
    //     { parameterName: "/my-app/dev/db-password", version: 1 }
    //   );
    // Look up the default vpc
    // The default is public so proceed accordingly

    //
    // ---- HostedZone and image registry
    this.sha = "...";

    const repo = ecr.Repository.fromRepositoryName(
      this,
      "sheetarepoID",
      "sheeta"
    );

    // Doman nam ownership
    const certArn =
      "...";
    const domainName = "whatever.com";

    const dn = new apigwv2.DomainName(this, "DN", {
      domainName,
      certificate: acm.Certificate.fromCertificateArn(this, "cert", certArn),
    });

    //
    // ---- Lambda and the container

    // Drone builds and tags from the lambda base image, "requires" a AWS
    // provided image to build easily

    const sheetaLambdaRole = new iam.Role(this, "sheeta-execution-role", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    // sheetaLambdaRole.grant(
    //   new iam.ServicePrincipal("lambda.amazonaws.com"),
    //   "sts:AssumeRole"
    // );
    // sheetaLambdaRole.grant(sheetaLambdaRole, "ssm:Describe*", "ssm:GetParam*");
    sheetaLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "ssm-get-policy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["ssm:Describe*", "ssm:GetParam*"],
            resources: ["arn:aws:ssm:us-east-1:...:parameter/*"],
          }),
          new iam.PolicyStatement({
            actions: [
              "route53:GetHostedZone",
              "route53:ListResourceRecordSets",
              "route53:ListHostedZones",
              "route53:ChangeResourceRecordSets",
              "route53:ListResourceRecordSets",
              "route53:GetHostedZoneCount",
              "route53:ListHostedZonesByName"
            ],
            resources: ["arn:aws:route53:::hostedzone/*"]
          }),
        ],
      })
    );


    sheetaLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );
    sheetaLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole"
      )
    ); // only required if your function lives in a VPC

    const sheetaLambda = new lambda.DockerImageFunction(this, "ECRFunction", {
      role: sheetaLambdaRole,
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

    //
    // ------ Networking

    const hz = r53.HostedZone.fromHostedZoneAttributes(
      this,
      "whatever-hostedzone",
      { zoneName: "whatever.com", hostedZoneId: "..." }
    );

    new r53.ARecord(this, "ARecord", {
      zone: hz,
      target: r53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          dn.regionalDomainName,
          dn.regionalHostedZoneId
        )
      ),
    });

    // new r53.CnameRecord(this, "CRecord", {
    //   domainName: "www." + dn.toString(),
    //   zone: hz,
    // });
  }
}

