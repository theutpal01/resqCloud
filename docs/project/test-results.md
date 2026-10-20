# Verification record

Verification performed in the build workspace on 25 September 2026.

| Check                             | Result                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| TypeScript                        | Passed for API/shared packages and Next.js                                                                         |
| API/domain tests                  | 15 passed                                                                                                          |
| Browser tests                     | 2 passed: dispatcher login/detail/Escape/accessibility/responsive width; anonymous report/private receipt/tracking |
| Automated accessibility           | No axe violations on the tested dispatcher overview                                                                |
| Mobile layout                     | Checked at 390 × 844; no document-level horizontal overflow; incident table scrolls within its container           |
| Production builds                 | Express TypeScript and Next.js build passed                                                                        |
| Live Aurora PostgreSQL/AWS/Mapbox | Not tested; local runtime and API tests use SQLite                                                                 |

The screenshots in this folder show the actual running application with development data. Browser tests currently cover two flows, not the full production acceptance suite. The main lifecycle is covered through real Express requests and a migrated test database.

Not measured: Lighthouse/CWV budgets, sustained concurrency, cold-start offline behavior, screen-reader behavior, cloud failover, Aurora PostgreSQL locking behavior or AWS disaster recovery. See [status.md](status.md) for release gates.

## Codebase cleanup verification — October 6, 2026

| Check                    | Result                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint and Prettier      | Passed                                                                                                                                           |
| TypeScript               | Passed                                                                                                                                           |
| API/domain tests         | 15 passed; AWS integrations forced off in test configuration                                                                                     |
| API TypeScript build     | Passed                                                                                                                                           |
| Next.js production build | Not verified in this environment: Node.js 26.7.0 causes Next.js to fail parsing `tsc --showConfig`; the documented project runtime is Node.js 24 |

## AWS console workflow update — October 6, 2026

| Check                 | Result                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| ESLint and Prettier   | Passed                                                                        |
| TypeScript            | Passed                                                                        |
| API/domain tests      | 15 passed                                                                     |
| AWS resource creation | Not run; no AWS resources were created in this workspace                      |
| Console integration   | Not live-tested; requires resources and credentials in the user's AWS account |

The user selected direct AWS Console management. Infrastructure-as-code files
and setup instructions were removed; no AWS resources were created or changed
by this update. The console walkthrough is documented in [the AWS showcase](../aws/service-showcase.md).

## Aurora PostgreSQL alignment — October 7, 2026

| Check                   | Result                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| ESLint and Prettier     | Passed                                                                                             |
| TypeScript              | Passed                                                                                             |
| API/domain tests        | 15 passed                                                                                          |
| API TypeScript build    | Passed                                                                                             |
| Database implementation | PostgreSQL and Aurora IAM-token support enabled; SQLite retained for local tests                   |
| Live Aurora connection  | Not tested; `.env` contains a placeholder endpoint until the cluster is created in the AWS Console |

The project environment now selects PostgreSQL. The AWS-specific environment
uses IAM database authentication and verified TLS. No Aurora cluster or other
AWS resource was created by this change.
