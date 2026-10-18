import { beforeEach, describe, expect, it, vi } from 'vitest';

type Registry = typeof import('./notification-click-commands');

function alert(type: string) {
  return { type, data: [] } as unknown as PrunApi.Alert;
}

describe('notificationClickCommand', () => {
  let registry: Registry;

  beforeEach(async () => {
    vi.resetModules();
    registry = await import('./notification-click-commands');
  });

  it('resolves nothing when no feature registered a command', () => {
    expect(registry.notificationClickCommand(alert('COGC_PROGRAM_CHANGED'))).toBeUndefined();
  });

  it('resolves nothing for a missing alert', () => {
    registry.registerNotificationClickCommand(() => 'COGCPD p-A pn-B');
    expect(registry.notificationClickCommand(undefined)).toBeUndefined();
  });

  it('resolves the registered command for a matching alert', () => {
    registry.registerNotificationClickCommand(x =>
      x.type === 'COGC_PROGRAM_CHANGED' ? 'COGCPD p-A pn-B' : undefined,
    );
    expect(registry.notificationClickCommand(alert('COGC_PROGRAM_CHANGED'))).toBe(
      'COGCPD p-A pn-B',
    );
    expect(registry.notificationClickCommand(alert('SHIP_FLIGHT_ENDED'))).toBeUndefined();
  });

  it('asks each registered feature until one resolves', () => {
    registry.registerNotificationClickCommand(x =>
      x.type === 'SHIP_FLIGHT_ENDED' ? 'SHPI AB-123' : undefined,
    );
    registry.registerNotificationClickCommand(x =>
      x.type === 'COGC_PROGRAM_CHANGED' ? 'COGCPD p-A pn-B' : undefined,
    );
    expect(registry.notificationClickCommand(alert('SHIP_FLIGHT_ENDED'))).toBe('SHPI AB-123');
    expect(registry.notificationClickCommand(alert('COGC_PROGRAM_CHANGED'))).toBe(
      'COGCPD p-A pn-B',
    );
  });
});
