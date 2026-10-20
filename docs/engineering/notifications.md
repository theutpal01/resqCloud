# Notifications

The inbox is scoped to the current user. Incident events notify the reporter, assigned responder, relevant department dispatch/supervision and admins. Anonymous contact information is not included. Users can mark individual or all notifications read.

WebSocket events prompt a scoped REST reload. Polling runs every 30 seconds while disconnected. Critical events may be published to the configured SNS topic. Email/SMS/mobile-push subscriptions, user preferences and delivery acknowledgments remain pending. SNS publishing is not a substitute for those workflows.
