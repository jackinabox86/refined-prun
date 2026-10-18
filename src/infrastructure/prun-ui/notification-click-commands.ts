type NotificationClickCommand = (alert: PrunApi.Alert) => string | undefined;

const clickCommands: NotificationClickCommand[] = [];

// Features that replace the buffer a plain notification click opens register
// the replacement here, so other notification gestures can open the same buffer.
// Only enabled features run init, so a disabled override never resolves.
export function registerNotificationClickCommand(resolve: NotificationClickCommand) {
  clickCommands.push(resolve);
}

export function notificationClickCommand(alert: PrunApi.Alert | undefined) {
  if (alert === undefined) {
    return undefined;
  }
  for (const resolve of clickCommands) {
    const command = resolve(alert);
    if (command !== undefined) {
      return command;
    }
  }
  return undefined;
}
