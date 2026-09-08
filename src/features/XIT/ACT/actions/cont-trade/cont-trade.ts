import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/actions/cont-trade/Edit.vue';
import Configure from '@src/features/XIT/ACT/actions/cont-trade/Configure.vue';
import { CONT_TRADE } from '@src/features/XIT/ACT/action-steps/CONT_TRADE';
import { Config } from '@src/features/XIT/ACT/actions/cont-trade/config';
import { AssertFn, configurableValue } from '@src/features/XIT/ACT/shared-types';
import {
  displayLocationValue,
  resolveLocation,
} from '@src/features/XIT/ACT/actions/cont-locations';
import {
  isValidContractPrice,
  maxContractPrice,
  minContractPrice,
} from '@src/features/XIT/ACT/actions/cont-limits';

act.addAction<Config>({
  type: 'CONT Trade',
  shortDescription: 'Create a buy/sell trade contract draft for a material group',
  description: (action, config) => {
    if (!action.group || !action.contLocation) {
      return '--';
    }

    const tradeLabel = action.contTradeType === 'SELLING' ? 'Sell' : 'Buy';
    const location =
      action.contLocation === configurableValue
        ? (config?.location ?? 'configured location')
        : displayLocationValue(action.contLocation);

    return `${tradeLabel} contract for [${action.group}] at ${location}`;
  },
  editComponent: Edit,
  configureComponent: Configure,
  needsConfigure: data => {
    return data.contLocation === configurableValue;
  },
  isValidConfig: (data, config) => {
    return data.contLocation !== configurableValue || config.location !== undefined;
  },
  generateSteps: async ctx => {
    const {
      data,
      config,
      packageName,
      getMaterialGroup,
      getMaterialGroupPrices,
      getMaterialGroupPlanet,
      emitStep,
    } = ctx;
    const assert: AssertFn = ctx.assert;

    const materials = await getMaterialGroup(data.group);
    assert(materials, 'Invalid material group');

    const traded = Object.keys(materials).filter(x => materials[x] > 0);
    assert(traded.length > 0, 'Material group has no materials to trade');

    // Every traded material needs its own price: a blank one on the template
    // would go out as a free trade. Checked here so the package fails before
    // the run touches a draft.
    const prices = getMaterialGroupPrices(data.group) ?? {};
    assert(
      traded.every(x => isValidContractPrice(prices[x])),
      `Each material in [${data.group}] needs a price from ${minContractPrice} to ${maxContractPrice}. Use a Paste group with 3 columns (ticker, amount, price).`,
    );

    const location = resolveLocation(data.contLocation, config?.location, getMaterialGroupPlanet);
    assert(location, 'Invalid location');

    const tradeType = data.contTradeType ?? 'BUYING';
    const daysToFulfill = data.daysToFulfill ?? 3;
    const currency = data.currency ?? 'NCC';

    emitStep(
      CONT_TRADE({
        packageName,
        materials,
        prices,
        tradeType,
        location,
        currency,
        daysToFulfill,
      }),
    );
  },
});
