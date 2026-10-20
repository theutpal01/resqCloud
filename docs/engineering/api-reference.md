# API reference

Base: `/api/v1`. JSON errors contain `error` and `requestId`; validation failures may contain `details`. Protected calls use `Authorization: Bearer <access-token>`; browser requests include credentials for refresh/logout. A different mutation Origin is rejected.

| Method/path                                                         | Purpose                                                                                         | Access                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /health`, `GET /ready`                                         | Liveness/dependency readiness (outside API prefix)                                              | Public                                                                       |
| `POST /auth/register`                                               | Development citizen registration                                                                | Public; disabled in production                                               |
| `POST /auth/demo-login`                                             | Quick sign-in to a seeded role                                                                  | Only enabled by `npm run demo` for loopback SQLite development               |
| `POST /auth/login`                                                  | Password/TOTP login                                                                             | Rate-limited                                                                 |
| `POST /auth/cognito`                                                | Verified Cognito ID-token exchange                                                              | Public                                                                       |
| `POST /auth/refresh`, `/auth/logout`                                | Rotate/revoke refresh cookie                                                                    | Cookie                                                                       |
| `GET /auth/me`, `/auth/sessions`                                    | Identity/device sessions                                                                        | Signed in                                                                    |
| `DELETE /auth/sessions/:id`                                         | Revoke own session                                                                              | Owner                                                                        |
| `POST /incidents`, `/sos`                                           | Report or critical SOS                                                                          | Anonymous or signed in                                                       |
| `GET /jurisdictions`, `GET /policy`                                 | Active reporting areas; accepted categories, department routing, and response targets           | Public                                                                       |
| `GET /incidents`                                                    | Scoped queue                                                                                    | Signed in                                                                    |
| `GET /incidents/:id`                                                | Detail/history                                                                                  | Authorized scope                                                             |
| `POST /tracking`                                                    | Tracking ID + private token lookup                                                              | Possession of both credentials                                               |
| `POST /incidents/:id/transition`                                    | `{status, reason}`                                                                              | Transition and scope policy                                                  |
| `PATCH /incidents/:id/severity`                                     | `{severity, reason}`                                                                            | Dispatcher/supervisor/admin                                                  |
| `GET /incidents/:id/recommendations`                                | Ranked eligible responders                                                                      | Dispatch authority                                                           |
| `GET /incidents/:id/duplicates`                                     | Rule-based duplicate candidates                                                                 | Dispatch authority                                                           |
| `POST /incidents/:id/assign`                                        | `{responderId, reason}`                                                                         | Dispatch authority                                                           |
| `POST /incidents/:id/accept`                                        | Accept current assignment                                                                       | Assigned responder                                                           |
| `POST /incidents/:id/feedback`                                      | Rating/comment                                                                                  | Reporter, after closure, once                                                |
| `PATCH /incidents/:id/public`                                       | `{approved}`                                                                                    | Supervisor/admin                                                             |
| `GET /public/incidents`                                             | Approved, approximate records                                                                   | Public                                                                       |
| `POST /incidents/:id/media`                                         | Signed private S3 POST fields                                                                   | Incident scope                                                               |
| `POST /media/:id/confirm`                                           | Validate uploaded metadata                                                                      | Media owner + scope                                                          |
| `GET /incidents/:id/media`                                          | Confirmed media metadata                                                                        | Incident scope                                                               |
| `GET /media/:id/download`, `/media/:id/url`                         | Proxy or signed CDN access                                                                      | Incident scope                                                               |
| `GET /responders`                                                   | Scoped responder list                                                                           | Authority                                                                    |
| `PATCH /responders/me/availability`                                 | Duty state                                                                                      | Responder                                                                    |
| `POST /responders/me/location`                                      | Coordinates                                                                                     | On-duty responder                                                            |
| `GET /notifications`, `POST /notifications/read`                    | Notification inbox/read marks                                                                   | Owner                                                                        |
| `GET /analytics?from=&to=`                                          | Scoped counts, category/status groups, average durations, high/critical response-target status  | Signed in; dates are optional UTC calendar dates                             |
| `GET /incidents/export?from=&to=`                                   | Scoped incident CSV                                                                             | Scoped; export requires authority                                            |
| `GET /departments`                                                  | Department names                                                                                | Public                                                                       |
| `GET/POST /admin/users`                                             | List/create accounts                                                                            | Admin                                                                        |
| `PATCH /admin/users/:id`                                            | Change enabled state, role, department, or jurisdiction; revoke sessions and audit changes      | Admin; cannot edit self; responder active assignments restrict scope changes |
| `GET /admin/audit`, `/admin/configuration`, `/admin/dead-events`    | Operational records                                                                             | Admin                                                                        |
| `GET/POST /admin/jurisdictions`, `PATCH /admin/jurisdictions/:code` | List/create districts and activate or deactivate routing                                        | Admin                                                                        |
| `PUT /admin/policy`                                                 | Atomically update accepted categories, category departments, and high/critical response targets | Admin                                                                        |
| `POST /admin/dead-events/:id/retry`                                 | Retry exhausted outbox delivery                                                                 | Admin                                                                        |

Reports require an active `jurisdictionCode` chosen from `GET /jurisdictions`; this records the submitter's selected area and does not infer jurisdiction from coordinates. Districts are created inactive under an existing state/UT, then activated by an administrator. Queue query parameters: `page`, `pageSize` (1–50), `search`, `severity`, `status`, `sort` (`newest` or `oldest`). Analytics and CSV accept optional `from` and `to` dates in `YYYY-MM-DD`; both ends are inclusive and interpreted in UTC. Response durations measure report creation to the first `responding` status; resolution durations measure report creation to the latest `resolved` status after reopening. Only durations recorded after migration `004_incident_timing` are included, and the analytics response includes sample counts and configured high/critical targets. CSV is capped at 10,000 records and intentionally omits reporter identity, description, contact details and precise coordinates.

Example report:

```json
{
  "title": "Road accident near station",
  "description": "Two vehicles involved. Medical help requested.",
  "category": "accident",
  "severity": "high",
  "latitude": 12.97,
  "longitude": 79.14,
  "location": "Katpadi station",
  "peopleAffected": 2,
  "anonymous": true,
  "incidentTime": "2026-09-25T06:00:00.000Z",
  "clientId": "8a03de61-0e4b-4985-a5b7-3dd458889a9c"
}
```

Always generate a fresh `clientId` for a new report, retaining the same ID for retries of that report. Signed-in owners can replay the same request safely. Anonymous duplicate submissions return a conflict; the first receipt's private key cannot be recovered.
