# Tenner Alexa Skill

German (de-DE) Alexa custom skill "Tenner" ([ADR 0005](../docs/decisions/0005-alexa-platform.md), Alexa backlog
[`docs/backlog/alexa/`](../docs/backlog/alexa/)). This folder is its own npm package, next to `backend/` and
`frontend/`; Terraform for the skill Lambda lives in [`terraform/alexa.tf`](../terraform/alexa.tf).

**Current state (ALEXA-008):** Alexa notifications and reminders, Echo Show home-screen widget (ALEXA-007), plus daily briefing („starte meinen Tag“, also from an Alexa routine), Echo Show
dashboard with touch completion (ALEXA-006), completing and undoing Tenners by voice
(ALEXA-004), today/overdue/suggestion/work-left
questions (ALEXA-003, see "Supported Phrases"), account linking and speaker recognition (ALEXA-002). „Alexa, öffne Tenner Board“ greets the recognized
member by name, asks an unknown voice once „Wer spricht gerade?“ and asks unlinked accounts to link Tenner in the
Alexa app. Help, stop, cancel, fallback and session end are handled.

## Layout

```text
alexa/
├── widgets/tenner-status/                 home-screen widget APL package (ALEXA-007)
├── apl/                                    APL documents: dashboard.json, list.json (ALEXA-006)
├── skill-package/
│   ├── skill.json                          manifest (de-DE, development stage); endpoint filled at deploy time
│   └── interactionModels/custom/de-DE.json invocation name "tenner board", intents, samples
├── src/
│   ├── index.ts                            Lambda handler
│   ├── skill.ts                            skill builder, handler order
│   ├── handlers/                           one file per request/intent type
│   ├── speech.ts                           all German response texts
│   ├── briefing.ts                         daily briefing builder (pure, ALEXA-005)
│   ├── apl.ts                              Echo Show datasources (pure, ALEXA-006)
│   ├── answers.ts                          spoken answers from the dashboard (pure, ALEXA-003)
│   ├── dashboard.ts                        GET /dashboard types and call
│   ├── matcher.ts                          spoken text → Tenner (pure, ALEXA-004)
│   ├── tenners.ts                          Tenner list, complete/undo/history calls, dates
│   ├── session.ts                          linked token, API client, household context, speaker resolution
│   ├── tennerApi.ts                        Tenner API client (timeout, error kinds, correlation ID)
│   ├── config.ts                           environment (the only module reading process.env)
│   └── log.ts                              JSON log lines without personal data
└── tests/                                  vitest, request envelopes in tests/envelopes.ts
```

## Echo Show Widget (ALEXA-007)

A home-screen widget (`widgets/tenner-status/`: manifest, APL document bound to the Data Store object
`tenner/status`, sample data) shows „Heute: 3“, open minutes, overdue and — in the medium size — the next two
Tenners. Tapping it opens the skill on the dashboard.

How the data gets there (no request to the skill when the widget renders):

```text
API write (complete, undo, create, …) ──PutEvents "HouseholdChanged"──► EventBridge ──► tenner-notifier
tenner-notifier (every 15 min) ── day start in the household timezone / pending change ──┘
   └── household dashboard → WidgetSummary → LWA token (alexa::datastore) → Data Store PUT_OBJECT (target USER)
```

- Debounce: at most one push per minute; changes inside that minute are pushed by the next scheduled run.
- Targets: Alexa accounts registered by the skill on their first launch (`PUT /household/alexa-users/{id}`); an
  account Amazon rejects (404/410) is removed. Failures are retried once and logged; the next change or day start
  repairs the widget.
- Needs: the skill (`ALEXA_SKILL_ID`), the notifier (`NOTIFICATIONS_ENABLED`) and the LWA client in Parameter Store
  (README → "Secrets": `/tenner/prod/alexa/lwa-client-id`, `/tenner/prod/alexa/lwa-client-secret`).

**Spike (owner, manual, 1 day):** install the dev-stage skill's widget on a household Echo Show (de-DE), push once,
and record in `docs/backlog/alexa/ticket007.md`: devices, sizes, update latency, behavior after reboot and with
Alexa+. The widget package format and the Data Store request shape are taken from the documentation as of
2026-10 and are verified there (TD-036).

**Fallback (no-go or devices without widgets):** the daily briefing as a morning routine on the Echo Show
(ALEXA-005, shows the dashboard while speaking) and Alexa notifications for overdue Tenners (ALEXA-008) keep the
status visible.

## Alexa Notifications and Reminders (ALEXA-008)

Alexa is a notification channel of the notifier (NOTIFICATION-001) for every Alexa account of the household:

| Tenner notification | On Alexa |
|---|---|
| Overdue alert (NOTIFICATION-004, 17:00) | notification indicator (Proactive Event `AMAZON.MessageAlert.Activated`, count only — schemas allow no titles) |
| Daily digest (NOTIFICATION-003, member's time) | spoken reminder 60 s later: „Tenner: Heute 4 Tenner, 40 Minuten, 1 überfällig. Sag: Alexa, sag Tenner Board, starte meinen Tag, für Details.“ — created by the skill from a Skill Messaging message (only way to create reminders out of session) |

Setup (owner, after the widget prerequisites — LWA client in Parameter Store):

1. Web app → Einstellungen → Benachrichtigungen: choose **Alexa** for „Tagesüberblick“ and/or „Überfällig-Hinweise“
   (offered once an Alexa account of the household used the skill).
2. Alexa app → Tenner → Berechtigungen: allow **Erinnerungen** and turn on **Benachrichtigungen** — or say „Alexa,
   sag Tenner Board, aktiviere Erinnerungen“ (voice consent).
3. Quiet hours and the per-type toggles in Tenner's settings apply; one alert/digest per member and day.

The manifest declares the reminder and notifications (`alexa::devices:all:notifications:write`, required by Amazon
for any event publication) permissions and the `AMAZON.MessageAlert.Activated` publication; the
development stage uses the development Proactive Events endpoint (`ALEXA_SKILL_STAGE`).

## Daily Briefing and Routine (ALEXA-005)

„Alexa, sag Tenner Board, starte meinen Tag“ speaks, in this order and only non-empty parts: greeting by time of day in
the household timezone („Guten Morgen, Stefan.“), today's Tenners of the speaker (own + shared; household-wide
without a recognized speaker) with up to three titles, overdue ones (longest first), the household total and the
other members' counts (only with more than one member), a vacation notice, and „Soll ich dir den ersten Tenner
nennen?“ („ja“ → suggestion, then „erledigt“ completes it). At most about 100 words (≈ 40 s): titles are dropped
first, then the household sentence. On an Echo Show the dashboard is shown while speaking.

**Every morning automatically (Alexa routine, owner):** Alexa app → Mehr → Routinen → „+“ → Wenn: Zeitplan, z. B.
7:00 an Werktagen → Aktion hinzufügen: „Benutzerdefiniert“ → „sag Tenner Board, starte meinen Tag“ (or Skills → Tenner)
→ Von: Echo Show Küche → Speichern. Routines run without a recognized speaker, so the briefing is household-wide.
Skills cannot create routines themselves (the Routines Kit was discontinued on 2026-05-13); verify the menu names
in the current Alexa app.

## Echo Show (ALEXA-006)

Screen devices (`Alexa.Presentation.APL` in the request) get APL documents from `apl/`; voice-only devices are
unchanged. Documents only bind to datasources built in `src/apl.ts` (pure, tested).

| View | Shown on | Content |
|---|---|---|
| Dashboard (`apl/dashboard.json`) | launch (household-wide), „was ist heute fällig“ (filtered like the answer), after a completion (with „✓ Erledigt: …“ banner) | date, „Heute: 3 Tenner · 25 Minuten offen · 1 überfällig“, columns per member (max. 3, then „Weitere: …“) plus „Alle“, overdue band |
| List (`apl/list.json`) | „was ist überfällig“ | scrollable overdue list, „⚠ seit 4 Tagen · Julia“ |

Layout by viewport (no pixel layouts): Echo Show 5 (< 1100 × 600 dp) shows summary + the next three Tenners;
Echo Show 8/10 member columns; from 1600 dp (Show 15/21) additionally the overdue band and larger type (body
40 dp instead of 32 dp); portrait (Show 15 upright) stacks columns and overdue. Dark surface `#1c1f24`, primary
`#1976d2`, member accent colors from the ANALYTICS-009 dark palette by member position — always with the written
name; overdue uses icon + text, not color alone.

Tapping a Tenner row (touch target ≥ 64 dp) sends `SendEvent ["complete", tennerId, title]`; the skill completes
it like a voice completion (speaker or „Wer hat … gemacht?“, request ID as idempotency key), says „Erledigt: …“
and re-renders the dashboard with the banner. While a view is on screen the session stays open **without** an open
microphone (no reprompt); the device returns to its home screen after its own inactivity timeout (document
`idleTimeout` 2 minutes; verify the actual behavior per device).

**Not yet done:** screenshots per device class (needs the APL authoring tool in the developer console or the
devices); rendering was verified structurally by tests only.

## Supported Phrases (de-DE)

Inside the skill („Alexa, öffne Tenner Board“, then …) or one-shot („Alexa, frag Tenner Board, …“). „für Julia“ / „bei Julia“
works with every question; otherwise the answer is for the recognized speaker (own + shared Tenners) or, if nobody
is recognized, for the whole household.

| Question | Examples | Answer |
|---|---|---|
| Briefing (ALEXA-005) | „starte meinen Tag“, „guten Morgen“, „was ist heute los“, „gib mir einen Überblick“ | greeting, today (≤ 3 titles), overdue, household totals, vacation; „Soll ich dir den ersten Tenner nennen?“ |
| Today (ALEXA-003) | „was ist heute fällig“, „was muss ich heute machen“, „was steht heute für Julia an“ | count, minutes, up to three titles; „Soll ich die restlichen … vorlesen?“ → „ja“ / „nein“; nothing due → next upcoming Tenner |
| Overdue | „was ist überfällig“, „was habe ich vergessen“ | longest overdue first, „seit 4 Tagen“ |
| Suggestion | „was soll ich jetzt machen“, „hast du einen Vorschlag“ | overdue before due today, shortest first |
| Work left | „wie viel ist noch zu tun“, „wie viel Arbeit ist übrig“ | open minutes today + overdue, per member when household-wide |
| Complete (ALEXA-004) | „Altglas ist erledigt“, „erledige Mobility“, „ich habe die Pflanzen gegossen“ → slot, „hake Büro saugen ab“, „erledigt“ (after a suggestion) | „Erledigt: Mobility. Als Nächstes fällig am 12. Oktober.“ (+ „Nächstes Mal ist Julia dran.“ for rotating Tenners) |
| Undo (ALEXA-004) | „mach das rückgängig“, „das war falsch“ | the last completion of this session directly; otherwise today's latest completion (of the speaker) after „Soll ich sie rückgängig machen?“ |
| Speaker (ALEXA-002) | „ich bin Julia“, answer to „Wer spricht gerade?“ | maps the recognized voice to the member |
| Help / stop | „Hilfe“, „stopp“, „abbrechen“ | |

**Matching rules (ALEXA-004, `src/matcher.ts`):** titles are loaded as dynamic entities on launch (up to 100;
synonym without a leading article). Otherwise the spoken text is compared with every active Tenner: lowercase,
umlauts spelled out, articles dropped, token overlap with a small edit-distance tolerance (plural endings,
recognition errors), and „all spoken words appear in the title“. A Tenner is completed directly only with a score
of at least 0.8 and a lead of 0.15 over the next candidate; due/overdue Tenners of the speaker get a small bonus.
Otherwise Tenner asks („Meinst du Büro saugen oder Büro aufräumen?“, at most three options) or says it found
nothing. Tenners not due yet and paused Tenners are confirmed first. `completedBy` is the recognized speaker,
the only member, or the answer to „Wer hat … gemacht?“. The Alexa request ID is the `Idempotency-Key`, so Alexa's
retries never complete twice. Logs carry match outcome, score and Tenner ID only.

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
| Data | none stored in eu-west-1; household data only via the Tenner API with the linked member's token (2 s timeout per call) |

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
   „Alexa, öffne Tenner Board“.

The skill stays in the development stage: it works on all Echo devices of the developer account without
certification. Other Amazon accounts would need a beta test (at most 90 days); the skill is never published.

Invocation name: **„tenner board“** (ALEXA-010, as registered in the developer console). The interaction model in
`interactionModels/custom/de-DE.json` must keep the same name, because every deployment overwrites the console.

### Private skill (ALEXA-010)

The skill stays a private household skill and never appears in the Alexa Skills Store:

- It lives in the **development stage**, which only the devices of the developer's Amazon account can use. A skill
  becomes public only after "Submit for certification" and publication in the developer console — **never click
  that** (Distribution / Certification tabs).
- CI and `scripts/` only update the development stage (`-g development`); a test fails if a workflow or script
  submits, publishes or beta-tests the skill.
- The manifest is limited to Germany, not available worldwide, and its testing instructions say "never submitted".
- Further people only through an explicit beta test invitation (at most 90 days) — not planned.

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
   „Alexa, öffne Tenner Board“ Alexa asks „Wer spricht gerade?“; the answer is stored. Settings → Alexa in the web app
   lists and removes these mappings.

Error messages: not linked → „Bitte verknüpfe Tenner in der Alexa-App“ plus a link card; 401 (link expired or
revoked) → relink prompt; 403 (account without household member) → „Dieses Konto gehört zu keinem
Tenner-Haushalt“; API errors or timeouts (2 s per call) → „Tenner ist gerade nicht erreichbar“.

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
