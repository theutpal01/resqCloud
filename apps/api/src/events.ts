import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Op } from "sequelize";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import {
  Event,
  Incident,
  User,
  Session,
  Notification,
  ConsumedEvent,
} from "./database.js";
import { config } from "./config.js";
import type { DomainEvent } from "../../../packages/shared/src/index.js";
const aws = {
  region: config.AWS_REGION,
  ...(config.AWS_ENDPOINT ? { endpoint: config.AWS_ENDPOINT } : {}),
};
const sqs = new SQSClient(aws),
  sns = new SNSClient(aws);
let io: Server | undefined;
function errorDetails(error: unknown) {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorMessage: String(error) };
}
export function attachSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: config.APP_ORIGIN, credentials: true },
    maxHttpBufferSize: 16384,
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== "string") throw new Error();
      const payload = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "resqcloud",
        audience: "resqcloud-web",
      }) as jwt.JwtPayload;
      const user = await User.findByPk(String(payload.sub));
      const session = await Session.findOne({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revoked: false,
          expiresAt: { [Op.gt]: new Date() },
        },
      });
      if (!user?.get().enabled || !session) throw new Error();
      socket.data.userId = user.get().id;
      socket.data.sid = payload.sid;
      socket.data.exp = payload.exp;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
    const timer = setInterval(async () => {
      try {
        const session = await Session.findByPk(socket.data.sid);
        const user = await User.findByPk(socket.data.userId);
        if (
          !session ||
          session.get().revoked ||
          !user?.get().enabled ||
          Date.now() / 1000 >= socket.data.exp
        )
          socket.disconnect(true);
      } catch {
        socket.disconnect(true);
      }
    }, 15000);
    socket.on("disconnect", () => clearInterval(timer));
  });
  return io;
}
/** Transactional outbox retry loop. A single worker is supported per deployment. */
export async function processEvents() {
  const rows = await Event.findAll({
    where: {
      processedAt: null,
      dead: false,
      nextAttemptAt: { [Op.lte]: new Date() },
    },
    order: [["createdAt", "ASC"]],
    limit: 20,
  });
  for (const e of rows) {
    try {
      const domainEvent: DomainEvent = {
        eventId: e.get().id,
        eventType: e.get().eventType,
        version: 1,
        occurredAt: e.get().createdAt.toISOString(),
        aggregateId: e.get().aggregateId,
        payload: e.get().payload,
      };
      if (config.SQS_QUEUE_URL) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: config.SQS_QUEUE_URL,
            MessageBody: JSON.stringify(domainEvent),
            ...(config.SQS_QUEUE_URL.endsWith(".fifo")
              ? {
                  MessageGroupId: domainEvent.aggregateId,
                  MessageDeduplicationId: domainEvent.eventId,
                }
              : {}),
          }),
        );
      } else await deliverEvent(domainEvent);
      await e.update({ processedAt: new Date() });
    } catch (error) {
      const attempts = e.get().attempts + 1;
      await e.update({
        attempts,
        dead: attempts >= 5,
        nextAttemptAt: new Date(
          Date.now() + Math.min(300000, 1000 * 2 ** attempts),
        ),
      });
      console.error(
        JSON.stringify({
          level: "error",
          event: "outbox.delivery_failed",
          eventId: e.get().id,
          attempts,
          ...errorDetails(error),
        }),
      );
    }
  }
}
let isRunning = false;
export function startWorker() {
  // Long-poll SQS for up to 20 seconds, then wait one more second before the
  // next tick. This keeps idle demo queues well below the monthly free request
  // allowance while keeping local-only event delivery responsive.
  const intervalMs = config.SQS_QUEUE_URL ? 21000 : 2000;
  const timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await processEvents();
      await consumeQueue();
    } catch (error) {
      console.error(
        JSON.stringify({ event: "outbox.unavailable", ...errorDetails(error) }),
      );
    } finally {
      isRunning = false;
    }
  }, intervalMs);
  return async () => {
    clearInterval(timer);
    while (isRunning) await new Promise((resolve) => setTimeout(resolve, 50));
  };
}

/** Replayed queue messages do not create duplicate in-app notifications. SNS is at-least-once. */
export async function deliverEvent(e: DomainEvent) {
  if (await ConsumedEvent.findByPk(e.eventId)) return;
  const incident = await Incident.findByPk(e.aggregateId);
  if (!incident) return;
  const data = incident.get();
  const recipientIds = [data.reporterId, data.assignedTo].filter(
    (id): id is string => id !== null,
  );
  const recipients = await User.findAll({
    where: {
      enabled: true,
      [Op.or]: [
        ...(recipientIds.length ? [{ id: { [Op.in]: recipientIds } }] : []),
        {
          departmentId: data.departmentId,
          jurisdictionCode: data.jurisdictionCode,
          role: { [Op.in]: ["dispatcher", "supervisor"] },
        },
        { role: "admin" },
      ],
    },
  });
  for (const user of recipients) {
    const userId = user.get().id;
    const [notification, created] = await Notification.findOrCreate({
      where: { eventKey: `${e.eventId}:${userId}` },
      defaults: {
        id: randomUUID(),
        userId,
        incidentId: data.id,
        title: `${data.trackingId}: ${String(e.payload.status ?? data.status).replaceAll("_", " ")}`,
        severity: data.severity,
        readAt: null,
        eventKey: `${e.eventId}:${userId}`,
      },
    });
    io?.to(`user:${userId}`).emit("incident.updated", { id: data.id });
    if (created) {
      const notice = notification.get();
      io?.to(`user:${userId}`).emit("notification.created", {
        id: notice.id,
        title: notice.title,
        severity: notice.severity,
      });
    }
  }
  if (config.SNS_TOPIC_ARN && e.payload.severity === "critical")
    await sns.send(
      new PublishCommand({
        TopicArn: config.SNS_TOPIC_ARN,
        Subject: "ResQCloud critical incident",
        Message: JSON.stringify(e),
      }),
    );
  await ConsumedEvent.findOrCreate({
    where: { id: e.eventId },
    defaults: { id: e.eventId, consumer: "notifications-v1" },
  });
}
export async function consumeQueue() {
  if (!config.SQS_QUEUE_URL) return;
  const result = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: config.SQS_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 60,
    }),
  );
  const schema = z.object({
    eventId: z.uuid(),
    eventType: z.string().max(100),
    version: z.literal(1),
    occurredAt: z.iso.datetime(),
    aggregateId: z.uuid(),
    payload: z.record(z.string(), z.unknown()),
  });
  for (const message of result.Messages ?? []) {
    try {
      const e = schema.parse(JSON.parse(message.Body ?? ""));
      await deliverEvent(e);
      await sqs.send(
        new DeleteMessageCommand({
          QueueUrl: config.SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "queue.delivery_failed",
          messageId: message.MessageId,
          ...errorDetails(error),
        }),
      );
    }
  }
}
