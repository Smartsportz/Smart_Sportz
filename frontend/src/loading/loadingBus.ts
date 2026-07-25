let pendingRequests = 0;
let notify: ((loading: boolean) => void) | null = null;

export function setLoadingNotifier(callback: ((loading: boolean) => void) | null) {
  notify = callback;
  notify?.(pendingRequests > 0);
}

export function beginGlobalLoading() {
  pendingRequests += 1;
  notify?.(true);
}

export function endGlobalLoading() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  notify?.(pendingRequests > 0);
}
