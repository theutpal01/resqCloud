import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Router } from "express";
import { z } from "zod";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { config } from "./config.js";
import { authenticate, HttpError } from "./auth.js";
import { accessible, audit } from "./incidents.js";
import { Media } from "./database.js";
const client = new S3Client({
  region: config.AWS_REGION,
  ...(config.AWS_ENDPOINT
    ? { endpoint: config.AWS_ENDPOINT, forcePathStyle: true }
    : {}),
});
export const mediaRouter = Router();
mediaRouter.post("/incidents/:id/media", authenticate, async (req, res) => {
  if (!config.S3_BUCKET)
    throw new HttpError(503, "Evidence storage has not been configured");
  const i = await accessible(String(req.params.id), req.actor!);
  const b = z
    .object({
      contentType: z.enum([
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
      ]),
      size: z
        .number()
        .int()
        .min(1)
        .max(20 * 1024 * 1024),
    })
    .parse(req.body);
  const key = `${config.NODE_ENV}/${i.get().id}/${randomUUID()}`;
  const media = await Media.create({
    incidentId: i.get().id,
    ownerId: req.actor!.id,
    key,
    contentType: b.contentType,
    size: b.size,
    confirmed: false,
  });
  const upload = await createPresignedPost(client, {
    Bucket: config.S3_BUCKET,
    Key: key,
    Expires: 300,
    Fields: { "Content-Type": b.contentType },
    Conditions: [
      ["content-length-range", b.size, b.size],
      ["eq", "$Content-Type", b.contentType],
    ],
  });
  res.status(201).json({ mediaId: media.get().id, ...upload });
});
mediaRouter.post("/media/:id/confirm", authenticate, async (req, res) => {
  const media = await Media.findOne({
    where: { id: req.params.id, ownerId: req.actor!.id },
  });
  if (!media) throw new HttpError(404, "Evidence not found");
  await accessible(media.get().incidentId, req.actor!);
  const head = await client.send(
    new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: media.get().key }),
  );
  if (
    head.ContentLength !== media.get().size ||
    head.ContentType !== media.get().contentType
  )
    throw new HttpError(
      400,
      "Uploaded evidence does not match expected metadata",
    );
  await media.update({ confirmed: true });
  await audit(req.actor!.id, "media.confirmed", media.get().id, {});
  res.json({ ok: true });
});
mediaRouter.get("/incidents/:id/media", authenticate, async (req, res) => {
  await accessible(String(req.params.id), req.actor!);
  res.json(
    await Media.findAll({
      where: { incidentId: req.params.id, confirmed: true },
      attributes: ["id", "contentType", "size", "createdAt"],
    }),
  );
});
mediaRouter.get("/media/:id/download", authenticate, async (req, res) => {
  const media = await Media.findOne({
    where: { id: req.params.id, confirmed: true },
  });
  if (!media) throw new HttpError(404, "Evidence not found");
  await accessible(media.get().incidentId, req.actor!);
  const file = await client.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: media.get().key }),
  );
  if (!file.Body) throw new HttpError(404, "Evidence unavailable");
  res.setHeader("Content-Disposition", 'attachment; filename="evidence"');
  res
    .type(media.get().contentType)
    .send(Buffer.from(await file.Body.transformToByteArray()));
});

mediaRouter.get("/media/:id/url", authenticate, async (req, res) => {
  const media = await Media.findOne({
    where: { id: req.params.id, confirmed: true },
  });
  if (!media) throw new HttpError(404, "Evidence not found");
  await accessible(media.get().incidentId, req.actor!);
  if (
    !config.CLOUDFRONT_DOMAIN ||
    !config.CLOUDFRONT_PUBLIC_KEY_ID ||
    !config.CLOUDFRONT_PRIVATE_KEY_PATH
  )
    throw new HttpError(503, "Private CDN delivery is not configured");
  let privateKey: string;
  try {
    privateKey = await readFile(config.CLOUDFRONT_PRIVATE_KEY_PATH, "utf8");
  } catch {
    throw new HttpError(503, "CloudFront signing key is unavailable");
  }
  const url = getSignedUrl({
    url: `https://${config.CLOUDFRONT_DOMAIN}/${media.get().key}`,
    keyPairId: config.CLOUDFRONT_PUBLIC_KEY_ID,
    privateKey,
    dateLessThan: new Date(Date.now() + 300000).toISOString(),
  });
  res.json({ url, expiresIn: 300 });
});
