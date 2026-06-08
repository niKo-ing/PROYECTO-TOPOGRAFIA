import crypto from "node:crypto";
import { getRequiredEnv, isProd } from "@/shared/lib/env";

const DEV_COOKIE_NAME = "topo_session";
const PROD_COOKIE_NAME = "__Host-topo_session";
export const SESSION_COOKIE_NAME = isProd() ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecodeToBuffer(input) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64");
}

function sign(data) {
  const secret = getRequiredEnv("SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken({ email, ttlSeconds = 60 * 60 * 24 * 7 }) {
  const header = { alg: "HS256", typ: "JWT" };
  const nowSeconds = Math.floor(Date.now() / 1000);

  const payload = {
    email,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(sign(signingInput));

  return `${signingInput}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = sign(signingInput);
  const actualSignature = base64UrlDecodeToBuffer(encodedSignature);
  if (!timingSafeEqual(expectedSignature, actualSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeToBuffer(encodedPayload).toString("utf8"));
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!payload?.email || typeof payload.email !== "string") return null;
    if (!payload?.exp || typeof payload.exp !== "number") return null;
    if (payload.exp < nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromCookieStore(cookieStore) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return { email: payload.email };
}

export function setSessionCookie(response, { email }) {
  const token = createSessionToken({ email });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
