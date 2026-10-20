# Authorization

| Role       | Incident read scope | Mutations                                          |
| ---------- | ------------------- | -------------------------------------------------- |
| Citizen    | Own reports         | Report, closure feedback                           |
| Dispatcher | Own department      | Review, verify, assess, recommend/assign, escalate |
| Responder  | Assigned incidents  | Accept, respond, resolve; own duty/location        |
| Supervisor | Own department      | Dispatch actions plus close/reopen/public approval |
| Admin      | All departments     | Operational actions and account administration     |

Role and scope checks happen in Express. Incident lookup returns 404 when outside scope to avoid confirming record existence. Media uses the same access boundary. Public outputs are independent allowlisted projections. Room membership is server-assigned to authenticated user rooms; the browser cannot subscribe to arbitrary departments/incidents.
