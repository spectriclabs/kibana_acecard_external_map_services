/* eslint-disable @kbn/eslint/require-license-header */

import { schema, TypeOf } from '@kbn/config-schema';

export const mapConfigSchema = schema.object({
  urls: schema.arrayOf(schema.string(), {
    defaultValue: [
      'https://labs.waterdata.usgs.gov/geoserver/ows', // GEOSERVER Layers huc08 and nhdarea have time filters and respect cql bounding boxes nhdarea times span from 1998-2005
      // bulk of the features are 1999-06-17T04:00:00Z others are 2004-03-16T05:00:00Z and some have no fdate
    ],
  }),
  enabled: schema.boolean({ defaultValue: false }),
  customSymbolLabels: schema.arrayOf(schema.string(), {
    defaultValue: ['A', 'AH', 'S', 'SS', 'F'],
  }),
});

export type AcecardEMSConfig = TypeOf<typeof mapConfigSchema>;
