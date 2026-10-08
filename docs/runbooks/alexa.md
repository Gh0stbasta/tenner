# Runbook: Alexa Skill

Tenner's Alexa skill (`alexa/`, ADR 0005): skill Lambda `tenner-alexa-skill` in **eu-west-1**, Tenner API and
notifier in eu-central-1. First look: CloudWatch dashboard `tenner-prod` → Alexa section; skill logs
`/tenner/alexa-skill` (eu-west-1), notifier logs `/tenner/notifier`. One line per request (`event = skill_request`)
with intent, outcome, duration and API status — never tokens or Amazon IDs. The Alexa request ID is the
`x-correlation-id` of the API calls, so one voice request can be followed into `/tenner/api`.

```text
fields @timestamp, intent, outcome, durationMs, apiStatus, requestId
| filter event = "skill_request" and outcome in ["ERROR", "LINK_REQUIRED"]
| sort @timestamp desc
| limit 50
```

## Account linking broken / „Bitte verknüpfe Tenner“

- `LINK_REQUIRED` with `api_error kind=UNAUTHORIZED`: the refresh token was revoked or the Cognito client was
  replaced → Alexa app → Tenner → Konto verknüpfen erneut.
- „Dieses Konto gehört zu keinem Tenner-Haushalt“: the Google account behind the link has no household group →
  link with the Google account used in the web app, or assign the member (README → "Household membership").
- Linking fails in the Alexa app: compare the console's Account Linking values with `terraform output
  alexa_account_linking`; the redirect URLs must match `ALEXA_REDIRECT_URLS`.

## Speaker not recognized / wrong member

- Voice profile and "Skills personalisieren" must be on in the Alexa app (permission `alexa::person_id:read`).
- Wrong member: web app → Einstellungen → Alexa → „Zuordnung entfernen“; the next launch asks „Wer spricht gerade?“.

## Beta test expired (90 days)

The household's own developer account uses the development stage (no expiry). Invited accounts lose access after 90
days: start a new beta test in the developer console (Distribution → Beta Test) or use the developer account.

## Widget not updating

1. Notifier logs: `WidgetPushed` (reason `CHANGE`, `DAY_START`, `EVENING`, `PENDING_CHANGE`; targets, pushed) /
   `WidgetPushFailed` (status) / `WidgetUpdateFailed`. Meal widget (FOOD-018): `MealWidgetFailed` means the meal
   plan could not be read; the status widget is still pushed, the meal widget keeps its last data.
2. `secret unavailable` → set `/tenner/prod/alexa/lwa-client-id` and `…/lwa-client-secret` (README → "Secrets").
3. `targets: 0` → no Alexa account registered yet: open the skill once („Alexa, öffne Familien Zentrale“).
4. Status 401/403 → wrong LWA client or missing Data Store permission in the console; 404/410 → the account was
   removed as target (skill disabled), open the skill again.
5. Remove and re-add the widget on the Echo Show. Request shapes are unverified until the spike (TD-036).

## Notifications not arriving

1. Web app → Benachrichtigungen: Alexa chosen for the type, not inside quiet hours; digest at its time, overdue
   alerts at the evening time (default 18:00).
2. Alexa app → Tenner → Berechtigungen: Erinnerungen allowed, Benachrichtigungen on (or „Alexa, sag Familien Zentrale,
   aktiviere Erinnerungen“).
3. Notifier logs `NotificationDelivery` with `channel ALEXA`: `ALEXA_HTTP_403` = permission or schema rejected;
   skill logs `reminder_permission_missing` for reminders.

## Skill Lambda errors / timeouts

1. Skill logs with `outcome = ERROR`: `api_error` (`kind`, `status`) points to the Tenner API — follow the
   `requestId` into `/tenner/api` (`correlationId`).
2. p95 duration > 5 s: slow API calls (`apiMs`). Since MAINT-001 all calls of one request share a 6.5 s budget
   (one attempt at most 4 s; a GET without a response is retried once, so `apiCalls` can be one higher than the
   handler's calls). Alexa's limit is 8 s. A single `apiStatus 0` right after `platform.initStart` is a cold start;
   it is only a problem when it repeats.
3. `skill_error` with `requestType`: a bug in a handler → fix and redeploy. Since MAINT-004 system messages are
   not skill errors: `apl_runtime_error` (the widget's APL document failed on the device; `errors`
   names type and reason), `datastore_error` (widget data not delivered; `errorType`) and `unhandled_request`
   (another request type the skill does not use) are info lines. `system_exception` (MAINT-005) means Alexa rejected
   the skill's previous response; `errorType`/`errorMessage` say why, `causeRequestId` points to that response.

## Deploy warning "Alexa health check skipped"

The post-deploy health check simulates „öffne familien zentrale“ through Amazon's SMAPI simulator. That service sometimes
fails before it reaches the skill (`simulation status 'FAILED': An unexpected error occurred.`), even though the
skill works on devices and in the console. The check retries three times. If the simulator never answers, the deploy
stays green with this warning (HOTFIX-006). Check by hand: developer console → Test → `öffne familien zentrale`, or ask
an Echo. A wrong answer or a skill error still fails the deploy.

## Alexa+ behaves differently than classic Alexa

Alexa+ may route phrases differently. Test the phrase list in `alexa/README.md` on both; add sample utterances
for phrases that end in the fallback (monthly review of "unhandled utterances" in the developer console →
Analytics).

## Rollback

- Code and skill package: revert the commit on `main`; the deploy workflow redeploys the previous Lambda bundle and
  skill package and runs the health check.
- Emergency: in the Lambda console (eu-west-1) the previous code is gone after a deploy; re-run the deploy workflow
  of the last good commit instead. Disabling the whole skill: remove `ALEXA_SKILL_ID` (alexa/README.md).
