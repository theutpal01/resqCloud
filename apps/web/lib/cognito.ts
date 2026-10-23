const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
// The public app client ID must match between server rendering and the browser bundle.
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
export const cognitoEnabled = !!domain && !!clientId;
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
async function startCitizenAuth(flow: "login" | "signup") {
  if (!domain || !clientId)
    throw new Error("Citizen authentication is not configured");
  const verifier = encode(crypto.getRandomValues(new Uint8Array(48)));
  const state = encode(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem("resq-pkce", JSON.stringify({ verifier, state }));
  const challenge = encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: `${location.origin}/auth/callback`,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const endpoint = flow === "signup" ? "signup" : "oauth2/authorize";
  location.assign(`${domain.replace(/\/$/, "")}/${endpoint}?${params}`);
}
export const startCitizenLogin = () => startCitizenAuth("login");
export const startCitizenSignup = () => startCitizenAuth("signup");
export async function finishCitizenLogin() {
  if (!domain || !clientId)
    throw new Error("Citizen authentication is not configured");
  const params = new URLSearchParams(location.search);
  const saved = sessionStorage.getItem("resq-pkce");
  sessionStorage.removeItem("resq-pkce");
  if (!saved) throw new Error("Login session expired. Please sign in again.");
  const { verifier, state } = JSON.parse(saved);
  if (params.get("state") !== state || !params.get("code"))
    throw new Error("Could not validate the sign-in response");
  const response = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: params.get("code")!,
      redirect_uri: `${location.origin}/auth/callback`,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error("Citizen sign-in could not be completed");
  return (await response.json()).id_token as string;
}
