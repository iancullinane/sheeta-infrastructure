# sheeta-infrastructure

Requires you have a [sheeta](https://github.com/iancullinane/sheeta) container deployed in [ecr](https://aws.amazon.com/ecr/).


Will provide:

* HostedZone look up and cert generation
* API HTTP V2 Gateway
  * Lambda integration
  * Lambda role
  * Custom domains 
  * DNS config
* Container deployment
* Nested stack for base level resources
