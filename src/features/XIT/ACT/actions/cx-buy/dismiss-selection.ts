export function dismissMouseDownBlocksSelection(button: number, editable: boolean) {
  return button === 0 && !editable;
}

export function applyDismissSelectionBlock(
  event: { button: number; preventDefault: () => void },
  editable: boolean,
  selection: { removeAllRanges: () => void } | null,
) {
  if (!dismissMouseDownBlocksSelection(event.button, editable)) {
    return;
  }
  event.preventDefault();
  selection?.removeAllRanges();
}
