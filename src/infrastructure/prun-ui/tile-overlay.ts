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
  // Returns a close function, or undefined when the overlay could not be mounted.
  // Callers that outlive the player's own dismissal (a step that keeps a panel up
  // until Act) need a handle; everyone else ignores it.
): (() => void) | undefined {
  const onClosed = options?.onClosed;
  const container = findMountContainer(baseElementOrEvent);
  if (!container) {
    onClosed?.();
    return undefined;
  }
  const scrollView = _$(container, C.ScrollView.view);
  if (!scrollView) {
    onClosed?.();
    return undefined;
  }
  const content = scrollView.lastChild as HTMLElement | null;
  if (content) {
    content.style.display = 'none';
  }
  // The player can dismiss through the backdrop while the caller still holds the
  // handle, so closing has to be idempotent.
  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    fragmentApp.unmount();
    if (content) {
      scrollView.appendChild(content);
      content.style.display = '';
    }
    onClosed?.();
  };
  const fragmentApp = createFragmentApp(Overlay, {
    child: component,
    props: rootProps,
    dismissOnBackdrop: options?.dismissOnBackdrop ?? true,
    onClose: close,
  });
  fragmentApp.appendTo(scrollView);
  // The overlay is appended into the tile's own scroll view, which keeps whatever
  // scroll position the hidden content left behind. Without this reset an overlay
  // mounted over a scrolled tile opens part-way down its own content.
  scrollView.scrollTop = 0;
  return close;
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
