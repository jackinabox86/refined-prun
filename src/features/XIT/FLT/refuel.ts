import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { FLT_REFUEL_BUFFER_COMMAND } from './defaults';

export function openRefuelAllExchanges() {
  return showBuffer(FLT_REFUEL_BUFFER_COMMAND);
}
