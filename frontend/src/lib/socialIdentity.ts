const SOCIAL_ACTOR_KEY = "smart-sportz-social-actor";

export function socialActorKey() {
  const stored = localStorage.getItem(SOCIAL_ACTOR_KEY);
  if (stored) return stored;
  const generated = `actor_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  localStorage.setItem(SOCIAL_ACTOR_KEY, generated);
  return generated;
}
