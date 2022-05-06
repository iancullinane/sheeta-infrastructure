# sheeta-infrastructure

Requires you have a [sheeta](https://github.com/iancullinane/sheeta) container deployed in [ecr](https://aws.amazon.com/ecr/).

## Provides

After deployment you will have the following:

* API HTTP Gateway V2 for your domain name
* A lambda and its role with appropriate permissions
* The lambda assigned as an integration to the api gateway
  * This uses the `{proxy+}` route handling, so you don't have to deal with HTTP methods
* ACN cert for the domain (required for API Gateway v2)
* Appropriate networking

You will need to have already (or add to this):

* A hosted zone
* An ecr reop with a container to run in the integration

## Config and Interfaces

The `bin/sheeta-infrastructure.ts` file will attempt to load json files from a `config/` directory. These files must match interfaces within the project, and are used for deployment config.

```
// base.json
{
    "projectName": "sheeta",
    "appSha": "d5c8a8c409263468e126aa32b502d884c9ddd0d8",
    "domainName": "sheeta.cloud",
    "subDomain": "sheeta",
    "account": "208744038881",
    "repoName": "adventurebrave.com"
}

// local.json
{
    "account": "208744038881",
    "region": "us-east-2"
}
```

Will provide:

* HostedZone look up and cert generation
* API HTTP V2 Gateway
  * Lambda integration
  * Lambda role
  * Custom domains 
  * DNS config
* Container deployment
* Nested stack for base level resources
