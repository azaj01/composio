import type { TriggerListenEvent } from './types';

export const formatTriggerListenSummary = (event: TriggerListenEvent): string => {
  const userId = event.userId || '-';
  const connectedAccountId = event.metadata.connectedAccount.id || '-';
  return [
    `Trigger: ${event.triggerSlug}`,
    `Toolkit: ${event.toolkitSlug}`,
    `Trigger Id: ${event.id}`,
    `Connected Account: ${connectedAccountId}`,
    `User Id: ${userId}`,
  ].join('\n');
};
