import Overlay from '@src/components/Overlay.vue';
import ActionConfirmationOverlay from '@src/components/ActionConfirmationOverlay.vue';

export function showTileOverlay<T extends Component>(
  baseElementOrEvent: Element | Event,
  component: T,
  rootProps?: ExtractComponentProps<T>,
  options?: {
    onClosed?: () => void;
    // Default true. Pass false for an overlay the player must acknowledge on the
    // overlay itself; otherwise a stray click on the backdrop dismisses it.
    dismissOnBackdrop?: boolean;
  },
) {
  const onClosed = options?.onClosed;
  const container = findMountContainer(baseElementOrEvent);
  if (!container) {
    onClosed?.();
    return;
  }
  const scrollView = _$(container, C.ScrollView.view);
  if (!scrollView) {
    onClosed?.();
    return;
  }
  const content = scrollView.lastChild as HTMLElement | null;
  if (content) {
    content.style.display = 'none';
  }
  const fragmentApp = createFragmentApp(Overlay, {
    child: component,
    props: rootProps,
    dismissOnBackdrop: options?.dismissOnBackdrop ?? true,
    onClose: () => {
      fragmentApp.unmount();
      if (content) {
        scrollView.appendChild(content);
        content.style.display = '';
      }
      onClosed?.();
    },
  });
  fragmentApp.appendTo(scrollView);
}

export function showConfirmationOverlay(
  baseElementOrEvent: Element | Event,
  onConfirm: () => void,
  options?: {
    message?: string;
    confirmLabel?: string;
  },
) {
  const message = options?.message ?? 'Are you sure?';
  const confirmLabel = options?.confirmLabel ?? 'Confirm';
  const container = findMountContainer(baseElementOrEvent);
  if (!container) {
    return;
  }
  const fragmentApp = createFragmentApp(ActionConfirmationOverlay, {
    message,
    confirmLabel,
    onConfirm: () => {
      fragmentApp.unmount();
      onConfirm();
    },
    onClose: () => fragmentApp.unmount(),
  });
  fragmentApp.appendTo(container);
}

function findMountContainer(baseElementOrEvent: Element | Event) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = (baseElementOrEvent as any).target
    ? ((baseElementOrEvent as Event).target as Element)
    : (baseElementOrEvent as Element);
  return target.closest(`.${C.TileFrame.anchor}`);
}
