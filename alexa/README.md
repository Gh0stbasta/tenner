# Tenner Alexa Skill

German (de-DE) Alexa custom skill "Tenner" ([ADR 0005](../docs/decisions/0005-alexa-platform.md), Alexa backlog
[`docs/backlog/alexa/`](../docs/backlog/alexa/)). This folder is its own npm package, next to `backend/` and
`frontend/`; Terraform for the skill Lambda lives in [`terraform/alexa.tf`](../terraform/alexa.tf).

**Current state (ALEXA-003):** today, overdue, suggestion and work-left questions by voice (see "Supported
Phrases"), account linking and speaker recognition (ALEXA-002). „Alexa, öffne Tenner“ greets the recognized
member by name, asks an unknown voice once „Wer spricht gerade?“ and asks unlinked accounts to link Tenner in the
Alexa app. Help, stop, cancel, fallback and session end are handled.

## Layout

```text
alexa/
├── skill-package/
│   ├── skill.json                          manifest (de-DE, development stage); endpoint filled at deploy time
│   └── interactionModels/custom/de-DE.json invocation name "tenner", intents, samples
├── src/
│   ├── index.ts                            Lambda handler
│   ├── skill.ts                            skill builder, handler order
│   ├── handlers/                           one file per request/intent type
│   ├── speech.ts                           all German response texts
│   ├── answers.ts                          spoken answers from the dashboard (pure, ALEXA-003)
│   ├── dashboard.ts                        GET /dashboard types and call
│   ├── session.ts                          linked token, API client, household context, speaker resolution
│   ├── tennerApi.ts                        Tenner API client (timeout, error kinds, correlation ID)
│   ├── config.ts                           environment (the only module reading process.env)
│   └── log.ts                              JSON log lines without personal data
└── tests/                                  vitest, request envelopes in tests/envelopes.ts
```

## Supported Phrases (de-DE)

Inside the skill („Alexa, öffne Tenner“, then …) or one-shot („Alexa, frag Tenner, …“). „für Julia“ / „bei Julia“
works with every question; otherwise the answer is for the recognized speaker (own + shared Tenners) or, if nobody
is recognized, for the whole household.

| Question | Examples | Answer |
|---|---|---|
| Today (ALEXA-003) | „was ist heute fällig“, „was muss ich heute machen“, „was steht heute für Julia an“ | count, minutes, up to three titles; „Soll ich die restlichen … vorlesen?“ → „ja“ / „nein“; nothing due → next upcoming Tenner |
| Overdue | „was ist überfällig“, „was habe ich vergessen“ | longest overdue first, „seit 4 Tagen“ |
| Suggestion | „was soll ich jetzt machen“, „hast du einen Vorschlag“ | overdue before due today, shortest first |
| Work left | „wie viel ist noch zu tun“, „wie viel Arbeit ist übrig“ | open minutes today + overdue, per member when household-wide |
| Speaker (ALEXA-002) | „ich bin Julia“, answer to „Wer spricht gerade?“ | maps the recognized voice to the member |
| Help / stop | „Hilfe“, „stopp“, „abbrechen“ | |

One-shot questions end the session after the answer; inside an open session Tenner asks „Was möchtest du noch
wissen?“. Every answer also appears as a card in the Alexa app (APL screens follow in ALEXA-006).

## Development

```bash
cd alexa
npm ci
npm run lint
npm test          # vitest with coverage (80 % minimum)
npm run build     # typecheck + esbuild bundle dist/index.mjs
```

Only runtime dependencies: `ask-sdk-core` (official Alexa Skills Kit SDK, Apache-2.0: request parsing, response
builders, skill-ID check) and its peer `ask-sdk-model` (request/response types). Both are bundled by esbuild.

Adding an intent: add it to `interactionModels/custom/de-DE.json`, add a handler in `src/handlers/`, register it in
`src/skill.ts` **before** `FallbackIntentHandler` (the first matching handler wins), put texts in `src/speech.ts`,
and test it with an envelope from `tests/envelopes.ts`.

## Runtime

| Setting | Value |
|---|---|
| Lambda | `tenner-alexa-skill`, Node.js 22, arm64, 256 MB, timeout 7 s (Alexa waits at most 8 s) |
| Region | `eu-west-1` (`alexa_region`); the Alexa Skills Kit trigger does not exist in `eu-central-1` |
| Invocation | only the Alexa Skills Kit with the Tenner skill ID (Lambda permission `event_source_token`), plus the SDK's skill-ID check (`ALEXA_SKILL_ID`) |
| Environment | `TENNER_API_BASE_URL` (Tenner API stage), `ALEXA_SKILL_ID`, `LOG_LEVEL`, `ENVIRONMENT` |
| Logs | `/tenner/alexa-skill` in eu-west-1, 30 days |
| Data | none stored in eu-west-1; household data only via the Tenner API with the linked member's token (3 s timeout per call) |

## Activation (one-time, owner, outside this repository)

Until step 3 is done, Terraform creates no Alexa resources and the deploy workflow skips the skill deployment with
a notice.

1. **Create the skill** in the [Alexa developer console](https://developer.amazon.com/alexa/console/ask) with the
   household's Amazon account: name "Tenner", locale **German (DE)**, model **Custom**, hosting **Provision your
   own**, template **Start from scratch**. Copy the **skill ID** (`amzn1.ask.skill.<uuid>`) and, under
   Settings, the **vendor ID**.
2. **Extend `GitHubActionsDeployRole`** (see "CI Permissions" below) — before step 3.
3. GitHub → Settings → Secrets and variables → Actions:
   - **Variable** `ALEXA_SKILL_ID` = the skill ID (not secret).
   - **Secret** `ASK_VENDOR_ID` = the vendor ID.
   - **Secret** `ASK_REFRESH_TOKEN` = an LWA refresh token for SMAPI. Create it on your own computer with
     `npx ask-cli@2.30.7 util generate-lwa-tokens` (opens a browser login, prints a JSON with `refresh_token`).
     Never commit it. Rotate it by generating a new one and replacing the secret.
4. Run the deploy workflow (push to `main` or re-run). It builds the skill bundle, applies Terraform (Lambda in
   eu-west-1), then `scripts/deploy-alexa-skill.sh` uploads the manifest with the Lambda ARN and the interaction
   model to the **development** stage and waits for the model build.
5. In the developer console → Test, set "Skill testing is enabled in" to **Development**. On a household Echo:
   „Alexa, öffne Tenner“.

The skill stays in the development stage: it works on all Echo devices of the developer account without
certification. Other Amazon accounts would need a beta test (at most 90 days); the skill is never published.

If the console rejects the invocation name `tenner`, change it to `mein tenner` in
`interactionModels/custom/de-DE.json` and document it here.

## Account Linking (ALEXA-002, one-time, owner)

The skill acts as a household member through the same Cognito user pool and Google sign-in as the web app.

1. Alexa developer console → Tenner → Build → **Account Linking**: copy the three **Alexa Redirect URLs**.
2. GitHub → Settings → Secrets and variables → Actions → **Variable** `ALEXA_REDIRECT_URLS` = the URLs as a JSON
   list, e.g. `["https://layla.amazon.com/api/skill/link/<vendor-id>", "https://pitangui.amazon.com/api/skill/link/<vendor-id>", "https://alexa.amazon.co.jp/api/skill/link/<vendor-id>"]`.
   Deploy: Terraform creates the Cognito app client `tenner-alexa-prod` and adds it to the API authorizer.
3. Read the values for the console (with AWS access to the account):

   ```bash
   terraform -chdir=terraform output alexa_account_linking   # authorization/token URI, client ID, scopes
   aws cognito-idp describe-user-pool-client --user-pool-id <user_pool_id> --client-id <client_id> \
     --query UserPoolClient.ClientSecret --output text        # never commit or paste it anywhere else
   ```

4. Account Linking page: "Do you allow users to create an account or link to an existing account with you?" on;
   **Auth Code Grant**; Web Authorization URI = `authorization_uri`; Access Token URI = `access_token_uri`;
   Client ID / Secret from step 3; Authentication Scheme **HTTP Basic**; scopes `openid` and `tenner/household`.
   Save.
5. Alexa app → Skills → Tenner → **Link account** → sign in with the Google account you use in Tenner.
6. Voice recognition (optional): each person creates a voice profile in the Alexa app and enables
   "Personalize skills" for Tenner (permission `alexa::person_id:read` in `skill-package/skill.json`). On the first
   „Alexa, öffne Tenner“ Alexa asks „Wer spricht gerade?“; the answer is stored. Settings → Alexa in the web app
   lists and removes these mappings.

Error messages: not linked → „Bitte verknüpfe Tenner in der Alexa-App“ plus a link card; 401 (link expired or
revoked) → relink prompt; 403 (account without household member) → „Dieses Konto gehört zu keinem
Tenner-Haushalt“; API errors or timeouts (3 s per call) → „Tenner ist gerade nicht erreichbar“.

Rotating the client secret needs a new Cognito client (a Terraform change that replaces
`aws_cognito_user_pool_client.alexa`), new values in the console and relinking (TD-035).

## CI Permissions

The deploy role needs, in addition to the existing statements (resource names fixed, region `eu-west-1`):

- Lambda: `lambda:CreateFunction`, `GetFunction`, `GetFunctionConfiguration`, `GetFunctionCodeSigningConfig`,
  `UpdateFunctionCode`, `UpdateFunctionConfiguration`, `DeleteFunction`, `ListVersionsByFunction`,
  `AddPermission`, `RemovePermission`, `GetPolicy`, `TagResource`, `UntagResource`, `ListTags` on
  `arn:aws:lambda:eu-west-1:<account-id>:function:tenner-alexa-skill`
- CloudWatch Logs: `logs:CreateLogGroup`, `DeleteLogGroup`, `PutRetentionPolicy`, `TagResource`, `UntagResource`,
  `ListTagsForResource` on `arn:aws:logs:eu-west-1:<account-id>:log-group:/tenner/alexa-skill*` and
  `logs:DescribeLogGroups` (resource `*`)
- IAM: create/manage `tenner-alexa-skill-role` and its inline policy (`iam:CreateRole`, `GetRole`, `DeleteRole`,
  `TagRole`, `UntagRole`, `PutRolePolicy`, `GetRolePolicy`, `DeleteRolePolicy`, `ListRolePolicies`,
  `ListAttachedRolePolicies`, `ListInstanceProfilesForRole`) and `iam:PassRole` for it to `lambda.amazonaws.com`

If the existing statements already use `/tenner/*` and `tenner-*` patterns without a region restriction, only the
Lambda function ARN and the role need adding. The skill package itself is deployed with the ASK secrets, not with
AWS permissions.

## Rollback

- Code: revert the commit on `main`; the deploy workflow redeploys the previous Lambda bundle and skill package.
- Disable the skill: remove the GitHub variable `ALEXA_SKILL_ID` and deploy — Terraform then destroys the Lambda,
  its role and log group in eu-west-1 (the skill in the developer console stays and simply has no endpoint).
  Re-adding the variable recreates everything.

## Limitations

- The skill package deployment (`scripts/deploy-alexa-skill.sh`, ASK CLI 2.30.7 with environment credentials)
  could not be run from this repository's development environment; verify it on the first deployment.
- eu-west-1 resources are not part of the tag-based AWS Resource Group `Tenner` (resource groups are regional).
