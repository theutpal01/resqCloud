# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

ResQCloud supports equal end-to-end use across its roles: citizens and anonymous reporters submit reports and follow progress; dispatchers and supervisors review incidents and coordinate response; responders handle assigned incidents; administrators manage users and operations.

## Product Purpose

Coordinate incidents from report through resolution. A successful response lets people report an incident, authorized teams review and assign it, responders record progress, supervisors close it, and reporters provide feedback.

## Positioning

The product's primary outcome is end-to-end incident coordination. No distinct market position or mechanism has been confirmed; do not invent one.

## Operating Context

The web application provides public reporting, private report tracking, and role-scoped operational workspaces. The documented workflow moves a report through review, verification, severity assessment, responder assignment, response, resolution, supervisory closure, and reporter feedback. Dispatchers, responders, and supervisors work within assigned operational scopes.

The repository describes a locally runnable implementation. Production deployment and configured cloud integrations are not established. The user-facing SOS flow requires connectivity and GPS permission, creates a critical incident in the platform, and does not contact external emergency services.

## Capabilities and Constraints

- Public or signed-in incident reporting, including anonymous reports, location details, and a private tracking receipt.
- Role- and scope-authorized incident review, status changes, assignment, escalation, resolution, and closure.
- Responder availability and location, notifications, analytics, incident export, audit history, and administration.
- Signed-in users can keep encrypted offline report drafts on an already-open client; drafts expire after 24 hours and retry on reconnection. Anonymous offline receipts, offline attachments, and cold-start offline support are not implemented.
- Mapbox, Cognito, S3, CloudFront, SQS, SNS, and Aurora PostgreSQL require configuration and live verification. Local development uses SQLite; the implementation has not been certified for production.
- The referenced `AGENT.md` policy specification was not supplied. Operating jurisdictions, retention rules, SLA definitions, and incident-specific policy requirements remain open; do not infer them.

## Brand Commitments

The existing product name is ResQCloud. Repository documentation does not establish a binding brand voice, legal language, customer promise, or market claim.

## Evidence on Hand

The repository contains a working local implementation, documented workflows and API contracts, development seed data, automated tests, and desktop and mobile UI captures. The README and implementation status explicitly state that production deployment is incomplete. No deployed service, customer evidence, or measured real-world response outcomes are documented; do not imply otherwise.

## Product Principles

- Support the incident lifecycle across public and operational roles.
- Keep access scoped to each person's role, ownership, and department.
- Protect reporter identity and tracking credentials.
- Show integration and production readiness honestly; never imply an external emergency call or unconfigured service succeeded.

## Accessibility & Inclusion

Meet WCAG 2.1 AA. Preserve keyboard access, screen-reader support, readable contrast and zoom, reduced-motion preferences, and mobile usability.
