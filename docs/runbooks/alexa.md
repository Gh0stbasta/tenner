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

1. Notifier logs: `WidgetPushed` (reason, targets, pushed) / `WidgetPushFailed` (status) / `WidgetUpdateFailed`.
2. `secret unavailable` → set `/tenner/prod/alexa/lwa-client-id` and `…/lwa-client-secret` (README → "Secrets").
3. `targets: 0` → no Alexa account registered yet: open the skill once („Alexa, öffne Tenner“).
4. Status 401/403 → wrong LWA client or missing Data Store permission in the console; 404/410 → the account was
   removed as target (skill disabled), open the skill again.
5. Remove and re-add the widget on the Echo Show. Request shapes are unverified until the spike (TD-036).

## Notifications not arriving

1. Web app → Benachrichtigungen: Alexa chosen for the type, not inside quiet hours; digest at its time, overdue
   alerts at 17:00.
2. Alexa app → Tenner → Berechtigungen: Erinnerungen allowed, Benachrichtigungen on (or „Alexa, sag Tenner,
   aktiviere Erinnerungen“).
3. Notifier logs `NotificationDelivery` with `channel ALEXA`: `ALEXA_HTTP_403` = permission or schema rejected;
   skill logs `reminder_permission_missing` for reminders.

## Skill Lambda errors / timeouts

1. Skill logs with `outcome = ERROR`: `api_error` (`kind`, `status`) points to the Tenner API — follow the
   `requestId` into `/tenner/api` (`correlationId`).
2. p95 duration > 5 s: slow API calls (`apiMs`); each call times out after 2 s, Alexa's limit is 8 s.
3. `skill_error` with `requestType`: an unknown request type or a bug in a handler → fix and redeploy.

## Alexa+ behaves differently than classic Alexa

Alexa+ may route phrases differently. Test the phrase list in `alexa/README.md` on both; add sample utterances
for phrases that end in the fallback (monthly review of "unhandled utterances" in the developer console →
Analytics).

## Rollback

- Code and skill package: revert the commit on `main`; the deploy workflow redeploys the previous Lambda bundle and
  skill package and runs the health check.
- Emergency: in the Lambda console (eu-west-1) the previous code is gone after a deploy; re-run the deploy workflow
  of the last good commit instead. Disabling the whole skill: remove `ALEXA_SKILL_ID` (alexa/README.md).
