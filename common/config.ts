/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { schema, TypeOf } from '@kbn/config-schema';

export const mapConfigSchema = schema.object({
  /* sources: schema.arrayOf(
    schema.object({
      wms: schema.string(),
      wfs: schema.string(),
      title: schema.string(),
      layer: schema.string(),
    }),
    {
      defaultValue: [
        {
          wms: 'https://mrdata.usgs.gov/services/active-mines',
          wfs: 'https://mrdata.usgs.gov/services/active-mines',
          title: 'Mines',
          layer: 'mineplant',
        },
      ],
    }
  ),*/
  titles: schema.arrayOf(schema.string(), { defaultValue: ['Mines', 'Phosphate', 'Energy'] }),
  urls: schema.arrayOf(schema.string(), {
    defaultValue: [
      'https://mrdata.usgs.gov/services/active-mines',
      'https://mrdata.usgs.gov/services/phosphate',
      'https://idena.navarra.es/ogc/ows',
    ],
  }),
  layers: schema.arrayOf(schema.string(), {
    defaultValue: ['mineplant', 'phosphate', 'IDENA:ENERGI_Lin_Peolico'],
  }),
});

export type AcecardEMSConfig = TypeOf<typeof mapConfigSchema>;
