/* eslint-disable @kbn/eslint/require-license-header */

import React from 'react';
import { LAYER_WIZARD_CATEGORY } from '@kbn/maps-plugin/common';
import type { LayerWizard, RenderWizardArguments } from '@kbn/maps-plugin/public';
import { PLUGIN_ID } from '../../common';
import { AcecardEMSEditor } from './acecard_ems_editor';

export const acecardEMSLayerWizard: LayerWizard = {
  id: PLUGIN_ID,
  categories: [LAYER_WIZARD_CATEGORY.REFERENCE],
  title: 'Acecard External Map Services',
  description: 'Layer that connects to other services for mapping display in acecard',
  prerequisiteSteps: [
    {
      id: 'CREATE_ACECARD_MAPS',
      label: 'Complete Layer Setup',
    },
  ],
  icon: '',
  order: 100,
  renderWizard: (renderWizardArguments: RenderWizardArguments) => {
    return <AcecardEMSEditor {...renderWizardArguments} />;
  },
};
