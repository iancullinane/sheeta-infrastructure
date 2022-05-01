import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as ecr from "aws-cdk-lib/aws-ecr";


var fqdn: string;
var subDomainHz: r53.IPublicHostedZone;

export interface ResourceProps extends cdk.NestedStackProps {
  projectName: string,
  domainName: string,
  certName: string,
  subDomain?: string,
}

export class NestedResourceStack extends cdk.NestedStack {
  // public readonly vpc: ec2.Vpc;

  public readonly cert: acm.ICertificate;
  public readonly hz: r53.IHostedZone;
  public readonly repo: ecr.IRepository;


  constructor(scope: Construct, id: string, props: ResourceProps) {
    super(scope, id, props);

    if (props.domainName === undefined) {
      console.log("TODO");
      return
    }

    // Find the top level domain only, we may (or may not) attach a new
    // subdomain in the next stanza
    // TODO::Double check logic here when there is no zone available
    let top = r53.HostedZone.fromLookup(this, `Zone-${props.domainName}`, { domainName: props.domainName });
    if (top.hostedZoneId === undefined) {

      // No top level zone, build one
      // props: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53.HostedZoneProps.html
      this.hz = new r53.HostedZone(this, "hosted-zone" + props.domainName, {
        zoneName: props.domainName,
      });
    } else {
      this.hz = top;
    }

    if (props.subDomain) {
      fqdn = `${props.subDomain}.${props.domainName}`

      subDomainHz = new r53.PublicHostedZone(this, "HostedZoneDev", {
        zoneName: fqdn,
      });
      // todo::This can probably be a downstream lookup
      new r53.NsRecord(this, "NsForParentDomain", {
        zone: top,
        recordName: fqdn,
        values: subDomainHz.hostedZoneNameServers!, // exclamation is like, hey it might be null but no: https://stackoverflow.com/questions/54496398/typescript-type-string-undefined-is-not-assignable-to-type-string
      });
    }

    if (subDomainHz) {
      this.hz = subDomainHz;
    }


    this.repo = ecr.Repository.fromRepositoryName(this, `Repository-${props.domainName}`, props.domainName)
    // TODO::If there is no repo use this:
    // this.repo = new ecr.Repository(this, `Repository-${props.projectName}-${tagger()}`, { repositoryName: fqdn });

    this.cert = new acm.Certificate(this, 'Certificate', {
      domainName: `*.${props.domainName}`,
      validation: acm.CertificateValidation.fromDns(top),
    });

  }
};

// For generating gibberish on ResourceIDs
function tagger(): string {
  let r = (Math.random() + 1).toString(36).substring(7);
  return r
}
