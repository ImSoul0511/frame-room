# AI implementation roadmap

| Step | AI Developer deliverable                                                                                            | Required review evidence                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | Agree [internal service contract](ai-service-contract.md) with Backend Developer and select model/version/dimension | Schema examples, timeout and failure mapping                                  |
| 2    | Build licensed, labeled corpus and data ledger                                                                      | Source/consent/license audit; query/gallery coverage                          |
| 3    | Establish offline retrieval and output baselines using MVP fixture as a seed                                        | Recall/precision, language extraction, latency and cost                       |
| 4    | Implement parser, embeddings and index pipeline, then concept/brief/edit/cull endpoints                             | Contract tests, model validation and provenance                               |
| 5    | Integrate with Fastify queue, Storage and budget ledger                                                             | Redelivery, unknown paid outcome, access recheck and two-account denial tests |
| 6    | Run human review and controlled end-to-end evaluation                                                               | Document pass thresholds and observed failures before enablement              |

Database Developer must settle pgvector schema and Storage policies before indexing; Backend Developer owns public endpoint stability and job/action state; DevOps owns service secrets, observability and deployment. The current Python `/health` does not satisfy any model contract. Do not report AI quality as complete based on scaffold health or synthetic demos.
