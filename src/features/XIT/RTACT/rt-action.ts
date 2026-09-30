import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/RTACT/Edit.vue';
import { RT_BUILD } from '@src/features/XIT/RTACT/RT_BUILD';
import { parseRouteId, parseRouteSpec } from '@src/features/XIT/RTACT/route-spec';
import { stagingRunBlock } from '@src/features/XIT/RTACT/staging-host';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';

act.addAction({
  type: 'Staging RT',
  shortDescription: 'Build a staging RT route from an ordered stop list',
  description: action => {
    const text = action.routeSpec?.trim() ?? '';
    if (text.length === 0) {
      return '--';
    }
    return 'Staging RT route';
  },
  editComponent: Edit,
  generateSteps: async ctx => {
    const { data, emitStep } = ctx;
    const assert: AssertFn = ctx.assert;
    const blocked = stagingRunBlock(location.hostname);
    if (blocked !== undefined) {
      assert(false, blocked);
    }
    const routeId = parseRouteId(data.routeId ?? '');
    assert(routeId.ok, routeId.ok ? '' : routeId.error);
    const spec = parseRouteSpec(data.routeSpec ?? '');
    assert(spec.ok, spec.ok ? '' : spec.error);
    emitStep(RT_BUILD({ routeId: routeId.id, stops: spec.spec.stops }));
  },
});
