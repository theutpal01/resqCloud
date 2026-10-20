import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

const prefix = "enc:v1:";
const key = createHash("sha256")
  .update(
    config.MFA_ENCRYPTION_KEY ?? `resqcloud-development-mfa:${config.JWT_SECRET}`,
  )
  .digest();

export function isEncryptedMfaSecret(value: string): boolean {
  return value.startsWith(prefix);
}

export function encryptMfaSecret(value: string): string {
  if (isEncryptedMfaSecret(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "enc",
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptMfaSecret(value: string): string {
  if (!isEncryptedMfaSecret(value)) return value;
  const [marker, version, encodedIv, encodedTag, encodedCiphertext] =
    value.split(":");
  if (
    marker !== "enc" ||
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  )
    throw new Error("Stored MFA secret has an invalid encrypted format");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Stored MFA secret cannot be decrypted with this key");
  }
}
