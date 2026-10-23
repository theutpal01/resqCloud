const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateMfaSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0;
  let value = 0;
  let encoded = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) encoded += alphabet[(value << (5 - bits)) & 31];
  return encoded;
}

export function authenticatorUri(secret: string, email: string) {
  const label = encodeURIComponent(`ResQCloud:${email.trim() || "administrator"}`);
  const query = new URLSearchParams({
    secret,
    issuer: "ResQCloud",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
