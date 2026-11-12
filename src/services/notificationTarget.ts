export type NotificationTarget =
  | {
      type: 'conversation';
      projectId: string;
      contactNumber: string;
      contactName: string;
    }
  | {
      type: 'case';
      projectId: string;
      contactNumber: string;
      contactName: string;
      caseName?: string;
    }
  | {
      type: 'campaign';
      projectId: string;
      campaignId: string;
      campaignName: string;
    };

function firstValue(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }
  return '';
}

export function getNotificationTarget(
  data: Record<string, unknown> | null | undefined,
): NotificationTarget | null {
  if (!data) return null;

  const rawType = firstValue(data, 'targetType', 'target_type', 'type')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const projectId = firstValue(data, 'projectId', 'project_id');
  if (!projectId) return null;

  if (rawType === 'campaign') {
    const campaignId = firstValue(data, 'campaignId', 'campaign_id');
    if (!campaignId) return null;
    return {
      type: 'campaign',
      projectId,
      campaignId,
      campaignName:
        firstValue(data, 'campaignName', 'campaign_name') || 'Campaign',
    };
  }

  const contactNumber = firstValue(
    data,
    'contactNumber',
    'contact_number',
    'number',
  );
  if (!contactNumber) return null;

  const contactName =
    firstValue(data, 'contactName', 'contact_name') || contactNumber;
  if (rawType === 'case') {
    return {
      type: 'case',
      projectId,
      contactNumber,
      contactName,
      caseName: firstValue(data, 'caseName', 'case_name') || undefined,
    };
  }

  if (
    rawType &&
    rawType !== 'conversation' &&
    rawType !== 'chat' &&
    rawType !== 'chat_message'
  ) {
    return null;
  }

  return {
    type: 'conversation',
    projectId,
    contactNumber,
    contactName,
  };
}
