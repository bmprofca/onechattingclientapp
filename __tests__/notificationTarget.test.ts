import { getNotificationTarget } from '../src/services/notificationTarget';

describe('getNotificationTarget', () => {
  it('keeps chat notifications scoped to their target project', () => {
    expect(
      getNotificationTarget({
        type: 'chat_message',
        projectId: 'project-1',
        contactNumber: '+15551234567',
        contactName: 'Alex',
      }),
    ).toEqual({
      type: 'conversation',
      projectId: 'project-1',
      contactNumber: '+15551234567',
      contactName: 'Alex',
    });
  });

  it('recognizes campaign and case targets only when their route identifiers exist', () => {
    expect(
      getNotificationTarget({
        target_type: 'campaign',
        project_id: 'project-1',
        campaign_id: 'campaign-1',
        campaign_name: 'Winter launch',
      }),
    ).toMatchObject({
      type: 'campaign',
      campaignId: 'campaign-1',
      campaignName: 'Winter launch',
    });
    expect(
      getNotificationTarget({
        targetType: 'case',
        projectId: 'project-1',
        contactNumber: '+15551234567',
        caseName: 'Refund',
      }),
    ).toMatchObject({ type: 'case', caseName: 'Refund' });
    expect(getNotificationTarget({ type: 'campaign' })).toBeNull();
    expect(
      getNotificationTarget({
        type: 'chat_message',
        contactNumber: '+15551234567',
      }),
    ).toBeNull();
    expect(
      getNotificationTarget({ type: 'unknown', contactNumber: '+15551234567' }),
    ).toBeNull();
  });
});
