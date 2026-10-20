# Events and failure handling

Event envelope: eventId, eventType, version, occurredAt, aggregateId and payload. Domain mutations create outbox records in the same DB transaction. A single worker processes up to 20 pending events per tick, with exponential backoff capped at five minutes. After five failures an event is marked dead and can be retried through the administrator interface.

Without SQS, notification delivery happens locally. With SQS, the outbox publishes and the queue consumer validates envelopes, delivers and deletes acknowledged messages. Failed messages remain for retry/visibility timeout and eventual SQS DLQ routing. In-app notification uniqueness and consumed-event records make replays idempotent. SNS remains at-least-once and can duplicate if the process dies after publish but before recording completion.

The administrator dead-event UI handles local outbox failures, not the external SQS DLQ. External redrive requires an operator-controlled AWS procedure. Multiple workers need a claim/lease mechanism before scaling.
