#!/usr/bin/env node
// Generate a VAPID key pair for browser push (NOTIFICATION-009) and the HMAC secret of the notification buttons
// (NOTIFICATION-011). Run once (locally or in AWS CloudShell):
//   node scripts/generate-vapid-keys.mjs
// The public key goes into the GitHub variable WEB_PUSH_PUBLIC_KEY; the private key only into Parameter Store
// (command printed below). Never commit or paste the private key anywhere else. A new key pair invalidates all
// existing browser subscriptions (members re-enable push in the settings).
import { createECDH, randomBytes } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const publicKey = ecdh.getPublicKey().toString("base64url");
// getPrivateKey() drops leading zero bytes; VAPID needs exactly 32 bytes.
const raw = ecdh.getPrivateKey();
const privateKey = Buffer.concat([Buffer.alloc(32 - raw.length), raw]).toString("base64url");

console.log(`WEB_PUSH_PUBLIC_KEY (GitHub variable):\n${publicKey}\n`);
console.log("Private key → Parameter Store (eu-central-1):");
console.log(
  `aws ssm put-parameter --region eu-central-1 --type SecureString --name /tenner/prod/push/vapid-private-key --value '${privateKey}'`,
);
console.log(
  `aws ssm put-parameter --region eu-central-1 --type SecureString --name /tenner/prod/push/action-secret --value '${randomBytes(32).toString("base64url")}'`,
);
