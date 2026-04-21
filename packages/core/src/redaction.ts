const REDACTED = "[REDACTED]";

const URL_SECRET_QUERY_PATTERN =
  /([?&](?:api[_-]?key|token|access[_-]?token|client[_-]?secret)=)([^&\s]+)/gi;
const BEARER_PATTERN = /(authorization\s*[:=]\s*bearer\s+)([^\s"',;]+)/gi;
const API_KEY_HEADER_PATTERN = /(x-api-key\s*[:=]\s*)([^\s"',;]+)/gi;
const ENV_SECRET_ASSIGNMENT_PATTERN =
  /(\b[A-Za-z_][A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CLIENT_SECRET)\b=)([^\s]+)/gi;
const KEY_VALUE_SECRET_PATTERN =
  /((?:api[_-]?key|access[_-]?key|secret|token|password|passwd|private[_-]?key|client[_-]?secret)[A-Za-z0-9_-]*\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSensitiveText(text: string, knownSecrets: readonly string[] = []): string {
  let redacted = text;

  const stableSecrets = [...new Set(knownSecrets)]
    .map((value) => value.trim())
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);

  for (const secret of stableSecrets) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), REDACTED);
  }

  redacted = redacted
    .replace(URL_SECRET_QUERY_PATTERN, `$1${REDACTED}`)
    .replace(BEARER_PATTERN, `$1${REDACTED}`)
    .replace(API_KEY_HEADER_PATTERN, `$1${REDACTED}`)
    .replace(ENV_SECRET_ASSIGNMENT_PATTERN, `$1${REDACTED}`)
    .replace(KEY_VALUE_SECRET_PATTERN, `$1${REDACTED}`);

  return redacted;
}
