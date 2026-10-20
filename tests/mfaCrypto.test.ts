import { describe, expect, it } from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  isEncryptedMfaSecret,
} from "../apps/api/src/mfaCrypto.js";

describe("MFA secret encryption", () => {
  it("round trips secrets and uses a fresh IV for each encryption", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const first = encryptMfaSecret(secret);
    const second = encryptMfaSecret(secret);

    expect(isEncryptedMfaSecret(first)).toBe(true);
    expect(decryptMfaSecret(first)).toBe(secret);
    expect(second).not.toBe(first);
  });

  it("rejects modified ciphertext and leaves legacy plaintext readable", () => {
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP");
    const pieces = encrypted.split(":");
    pieces[3] = `${pieces[3].startsWith("a") ? "b" : "a"}${pieces[3].slice(1)}`;

    expect(() => decryptMfaSecret(pieces.join(":"))).toThrow(
      "Stored MFA secret cannot be decrypted with this key",
    );
    expect(decryptMfaSecret("legacy-secret")).toBe("legacy-secret");
  });
});
