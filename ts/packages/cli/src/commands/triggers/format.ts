import type { TriggerListenEvent } from './types';
import { bold, gray } from 'src/ui/colors';
import { truncate } from 'src/ui/truncate';

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

const TRIGGER_TABLE = {
  timestamp: 24,
  triggerId: 20,
  triggerSlug: 22,
  toolkit: 8,
  userId: 16,
  connectedAccountId: 20,
} as const;

export const formatTriggerListenTableHeader = (): string =>
  [
    bold('Timestamp'.padEnd(TRIGGER_TABLE.timestamp)),
    bold('Trigger Id'.padEnd(TRIGGER_TABLE.triggerId)),
    bold('Trigger Slug'.padEnd(TRIGGER_TABLE.triggerSlug)),
    bold('Toolkit'.padEnd(TRIGGER_TABLE.toolkit)),
    bold('User Id'.padEnd(TRIGGER_TABLE.userId)),
    bold('Connected Account Id'),
  ].join(' ');

export const formatTriggerListenTableRow = ({
  timestamp,
  event,
}: {
  timestamp: string;
  event: TriggerListenEvent;
}): string => {
  const connectedAccountId = event.metadata.connectedAccount.id || '-';
  const userId = event.userId || '-';
  const timestampCell = truncate(timestamp, TRIGGER_TABLE.timestamp).padEnd(
    TRIGGER_TABLE.timestamp
  );
  const triggerIdCell = truncate(event.id, TRIGGER_TABLE.triggerId).padEnd(TRIGGER_TABLE.triggerId);

  return [
    gray(timestampCell),
    triggerIdCell,
    truncate(event.triggerSlug, TRIGGER_TABLE.triggerSlug).padEnd(TRIGGER_TABLE.triggerSlug),
    truncate(event.toolkitSlug, TRIGGER_TABLE.toolkit).padEnd(TRIGGER_TABLE.toolkit),
    truncate(userId, TRIGGER_TABLE.userId).padEnd(TRIGGER_TABLE.userId),
    truncate(connectedAccountId, TRIGGER_TABLE.connectedAccountId),
  ].join(' ');
};
