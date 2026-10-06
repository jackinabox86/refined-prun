import { act } from '@src/features/XIT/ACT/act-registry';
import { fixed0 } from '@src/utils/format';
import { selectAndChangeInputValue } from '@src/util';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { isValidContractPrice } from '@src/features/XIT/ACT/actions/cont-limits';
import {
  createNewDraft,
  setDraftNameAndPreamble,
  saveDraftDetails,
  openTemplate,
  selectTemplateType,
  setCurrency,
  addMaterials,
  setDeadline,
  applyTemplate,
  saveConditions,
} from '@src/features/XIT/ACT/action-steps/cont-utils';

interface Data {
  packageName: string;
  materials: Record<string, number>;
  prices: Record<string, number>;
  tradeType: 'BUYING' | 'SELLING';
  location: string;
  currency: string;
  daysToFulfill: number;
}

export const CONT_TRADE = act.addActionStep<Data>({
  type: 'CONT_TRADE',
  totalMaterials: data =>
    Object.fromEntries(Object.entries(data.materials).filter(([, v]) => v > 0)),
  description: data => {
    const materialCount = Object.keys(data.materials).length;
    const typeLabel = data.tradeType === 'BUYING' ? 'Buy' : 'Sell';
    return `Create ${typeLabel} contract draft (${materialCount} materials)`;
  },
  execute: async ctx => {
    const { data, log, setStatus, requestTile, waitAct, complete } = ctx;
    const assert: AssertFn = ctx.assert;

    const typeLabel = data.tradeType === 'BUYING' ? 'Buy' : 'Sell';

    // Step 1: Create new draft. The open is gated by this step's own ACT click,
    // so it must not cost a second one.
    await waitAct('Create new draft?');
    const listTile = await requestTile('CONTD', { actGate: false });
    if (!listTile) {
      return;
    }

    const newDraft = await createNewDraft(ctx);

    setStatus(`Loading draft ${newDraft.naturalId}...`);
    const draftTile = await requestTile(`CONTD ${newDraft.naturalId}`);
    if (!draftTile) {
      return;
    }
    const anchor = draftTile.anchor;

    // Set contract name.
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const contractName = `${data.packageName} - ${typeLabel} - ${dateStr}`;

    // Set preamble.
    const materialsList = Object.entries(data.materials)
      .map(([ticker, amount]) => {
        const price = data.prices[ticker];
        return price !== undefined
          ? `${ticker} x${fixed0(amount)} @ ${price}/u`
          : `${ticker} x${fixed0(amount)}`;
      })
      .join(', ');
    const preambleText =
      `${typeLabel} contract.\n` +
      `Materials: ${materialsList}\n` +
      (data.daysToFulfill > 0 ? `Fulfill within ${fixed0(data.daysToFulfill)} days` : '');

    await setDraftNameAndPreamble(ctx, anchor, contractName, preambleText);

    // Step 2: Save draft details (name/preamble)
    await waitAct('Save draft details?');
    await saveDraftDetails(ctx, anchor, newDraft.naturalId);

    const templateSelect = await openTemplate(ctx, anchor);
    selectTemplateType(ctx, templateSelect, data.tradeType);
    await setCurrency(ctx, anchor, data.currency);

    // Add materials with per-material prices.
    const materialEntries = Object.entries(data.materials)
      .filter(([, amount]) => amount > 0)
      .map(([ticker, amount]) => ({ ticker, amount }));

    await addMaterials(ctx, anchor, materialEntries, {
      setPrice: (group, ticker) => {
        // A row left without a price would go out as a free trade, so this is a
        // hard failure rather than a skipped field.
        const price = data.prices[ticker];
        assert(isValidContractPrice(price), `Invalid price for ${ticker}`);
        const priceInput = group.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
        assert(priceInput, `Could not find price input for ${ticker}`);
        selectAndChangeInputValue(priceInput, String(price));
        log.info(`Price for ${ticker}: ${price} ${data.currency}`);
      },
    });

    // Step 3: Set location address
    const addressContainers = _$$(anchor, C.AddressSelector.container) as HTMLElement[];
    assert(
      addressContainers.length >= 1 && data.location.length > 0,
      'Could not find trade location control',
    );
    await waitAct(`Set location to ${data.location}?`);
    const locationSet = await selectAddress(addressContainers[0], data.location);
    assert(locationSet, `Could not select location: ${data.location}`);
    log.info(`Location set: ${data.location}`);

    setDeadline(ctx, anchor, data.daysToFulfill);

    // Step 4: Apply template
    await waitAct('Apply template?');
    await applyTemplate(ctx, anchor, newDraft.naturalId);

    // Step 5: Save conditions, after the player has reviewed them.
    await waitAct('Save conditions?');
    await saveConditions(ctx, anchor, newDraft.naturalId);

    log.success(`Contract draft ${newDraft.naturalId} ready to send`);
    complete();
  },
});
