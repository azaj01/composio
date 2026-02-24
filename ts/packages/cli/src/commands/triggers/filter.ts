import type { TriggerListenEvent, TriggerListenFilters } from './types';

/**
 * Check if a trigger event matches the provided filters.
 *
 * IMPORTANT: `filters.toolkits` and `filters.triggerSlug` must be pre-normalized
 * to lowercase at construction time. This avoids per-event allocation from
 * repeated `.map(x => x.toLowerCase())` calls in long-running listen sessions.
 */
export const matchesTriggerListenFilters = (
  filters: TriggerListenFilters,
  data: TriggerListenEvent
): boolean => {
  if (filters.toolkits?.length && !filters.toolkits.includes(data.toolkitSlug.toLowerCase())) {
    return false;
  }

  if (filters.triggerId && filters.triggerId !== data.id) {
    return false;
  }

  if (
    filters.connectedAccountId &&
    filters.connectedAccountId !== data.metadata.connectedAccount.id
  ) {
    return false;
  }

  if (
    filters.triggerSlug?.length &&
    !filters.triggerSlug.includes(data.triggerSlug.toLowerCase())
  ) {
    return false;
  }

  if (filters.userId && filters.userId !== data.userId) {
    return false;
  }

  return true;
};
