export type FeedbackTone = 'success' | 'error' | 'info';

const errorPatterns = [
  /não foi possível/i,
  /\bfalh(?:a|ou|ar|ando)\b/i,
  /\berro\b/i,
  /cancelad[ao]/i,
  /não está configurad[ao]/i,
  /env ausente/i,
];

const successPatterns = [
  /\bimportad[ao]s?\b/i,
  /\bconclu[ií]d[ao]\b/i,
  /\brestaurad[ao]\b/i,
  /\bliberad[ao]s?\b/i,
  /\bsalv[ao]\b/i,
  /\bcriad[ao]\b/i,
  /\bencerrad[ao]\b/i,
  /\breiniciad[ao]\b/i,
];

export function classifyFeedback(message: string): FeedbackTone {
  if (errorPatterns.some(pattern => pattern.test(message))) return 'error';
  if (successPatterns.some(pattern => pattern.test(message))) return 'success';
  return 'info';
}
