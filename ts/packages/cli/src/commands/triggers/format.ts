import type { TriggerType } from 'src/models/trigger-types';
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

const TRIGGER_TYPES_TABLE = {
  slug: 35,
  name: 26,
  type: 8,
} as const;

export const formatTriggerTypesTable = (triggerTypes: ReadonlyArray<TriggerType>): string => {
  const header = [
    bold('Slug'.padEnd(TRIGGER_TYPES_TABLE.slug)),
    bold('Name'.padEnd(TRIGGER_TYPES_TABLE.name)),
    bold('Type'.padEnd(TRIGGER_TYPES_TABLE.type)),
    bold('Description'),
  ].join(' ');

  const rows = triggerTypes.map(triggerType => {
    const slug = truncate(triggerType.slug, TRIGGER_TYPES_TABLE.slug).padEnd(
      TRIGGER_TYPES_TABLE.slug
    );
    const name = truncate(triggerType.name, TRIGGER_TYPES_TABLE.name).padEnd(
      TRIGGER_TYPES_TABLE.name
    );
    const type = triggerType.type.padEnd(TRIGGER_TYPES_TABLE.type);
    const description = gray(truncate(triggerType.description, 50));
    return `${slug} ${name} ${type} ${description}`;
  });

  return [header, ...rows].join('\n');
};

export const formatTriggerTypesJson = (triggerTypes: ReadonlyArray<TriggerType>): string =>
  JSON.stringify(
    triggerTypes.map(triggerType => ({
      slug: triggerType.slug,
      name: triggerType.name,
      type: triggerType.type,
      description: triggerType.description,
    })),
    null,
    2
  );

function formatSchemaProperties(schema: Record<string, unknown>): string {
  const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
  if (!properties || Object.keys(properties).length === 0) {
    return '  (none)';
  }

  const requiredArr = (schema['required'] as string[] | undefined) ?? [];
  const requiredSet = new Set(requiredArr);

  const entries = Object.entries(properties).map(([name, prop]) => {
    const type = (prop['type'] as string) ?? 'unknown';
    const label = requiredSet.has(name) ? 'required' : 'optional';
    const description = prop['description'] as string | undefined;
    const hasDefault = Object.prototype.hasOwnProperty.call(prop, 'default');
    const defaultValue = hasDefault ? prop['default'] : undefined;
    return { name, type, label, description, hasDefault, defaultValue };
  });

  const typeWidth = Math.max(...entries.map(e => e.type.length));
  const labelWidth = Math.max(...entries.map(e => e.label.length));
  const metadataLabels = ['description:', 'type:', 'required:', 'default:'] as const;
  const metadataLabelWidth = Math.max(...metadataLabels.map(label => label.length));

  return entries
    .map(e => {
      const lines: string[] = [];
      lines.push(`  ${bold(e.name)}`);
      lines.push(
        `    ${'description:'.padEnd(metadataLabelWidth)} ${e.description ? gray(truncate(e.description, 70)) : '-'}`
      );
      lines.push(`    ${'type:'.padEnd(metadataLabelWidth)} ${e.type.padEnd(typeWidth)}`);
      lines.push(`    ${'required:'.padEnd(metadataLabelWidth)} ${e.label.padEnd(labelWidth)}`);
      if (e.hasDefault) {
        lines.push(
          `    ${'default:'.padEnd(metadataLabelWidth)} ${gray(truncate(JSON.stringify(e.defaultValue), 40))}`
        );
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export const formatTriggerTypeInfo = (triggerType: TriggerType): string => {
  const lines: string[] = [];

  lines.push(`${bold('Name:')} ${triggerType.name}`);
  lines.push(`${bold('Slug:')} ${triggerType.slug}`);
  lines.push(`${bold('Type:')} ${triggerType.type}`);
  lines.push(`${bold('Description:')} ${triggerType.description}`);
  lines.push(`${bold('Instructions:')} ${triggerType.instructions}`);

  lines.push('');
  lines.push(gray('------------------------------'));
  lines.push(bold('Config Fields:'));
  lines.push(formatSchemaProperties(triggerType.config));

  lines.push('');
  lines.push(gray('------------------------------'));
  lines.push(bold('Payload Fields:'));
  lines.push(formatSchemaProperties(triggerType.payload));

  return lines.join('\n');
};
