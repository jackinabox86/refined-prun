import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { userData } from '@src/store/user-data';
import { ComponentPublicInstance, reactive } from 'vue';
import MarketMenu from './MarketMenu.vue';

let clickOutsideListener: ((e: MouseEvent) => void) | null = null;

export const store = reactive({
  materialID: '',
  menuElement: {} as HTMLElement,
  menuStyle: {
    display: 'none',
    left: '0px',
    top: '0px',
  },
  async showMenu(event: MouseEvent, ticker: string) {
    this.materialID = ticker;
    this.menuStyle.display = 'block';
    await nextTick();
    store.setLocation(event);
    clickOutsideListener = (e: MouseEvent) => {
      if (!store.menuElement.contains(e.target as Node)) {
        store.hideMenu();
      }
    };
    document.addEventListener('click', clickOutsideListener);
  },
  hideMenu() {
    this.menuStyle.display = 'none';
    if (clickOutsideListener !== null) {
      document.removeEventListener('click', clickOutsideListener);
      clickOutsideListener = null;
    }
  },
  showBuffer(cmd: string) {
    this.hideMenu();
    if (cmd === 'CXM') {
      return showBuffer(`CXM ${this.materialID}`);
    } else if (['CXP', 'CXPC', 'CXPO', 'CXOB'].includes(cmd)) {
      return showBuffer(`${cmd} ${this.materialID}.${userData.settings.contextMenuExchange}`);
    }
    return;
  },
  setMenuElement(componentInstance: ComponentPublicInstance) {
    this.menuElement = componentInstance.$el as HTMLElement;
  },
  setLocation(event: MouseEvent) {
    const documentRect = this.menuElement.parentElement!.getBoundingClientRect();
    const tooltipRect = this.menuElement.getBoundingClientRect();
    if (event.clientX + tooltipRect.width > documentRect.right) {
      this.menuStyle.left = (documentRect.right - tooltipRect.width).toString() + 'px';
    } else {
      this.menuStyle.left = event.clientX.toString() + 'px';
    }
    if (event.clientY + tooltipRect.height > documentRect.bottom) {
      this.menuStyle.top = (event.clientY - tooltipRect.height).toString() + 'px';
    } else {
      this.menuStyle.top = event.clientY.toString() + 'px';
    }
  },
});

async function init() {
  const container = document.getElementById('container');
  if (container?.parentElement) {
    store.setMenuElement(createFragmentApp(MarketMenu).appendTo(container));
  }
  document.addEventListener('contextmenu', event => {
    const container = (event.target as HTMLElement).closest<HTMLElement>(
      `.${C.ColoredIcon.container}`,
    );
    if (container !== null) {
      event.preventDefault();
      store.showMenu(event, container.textContent ?? '');
      return;
    }
    store.hideMenu();
  });
}

features.add(
  import.meta.url,
  init,
  'Right click any material to quickly see material market buttons.',
);
