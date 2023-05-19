/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

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
  icon: '',
  order: 100,
  renderWizard: (renderWizardArguments: RenderWizardArguments) => {
    return <AcecardEMSEditor {...renderWizardArguments} />;
  },
};
