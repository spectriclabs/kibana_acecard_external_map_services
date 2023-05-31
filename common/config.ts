/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { schema, TypeOf } from '@kbn/config-schema';

export const mapConfigSchema = schema.object({
  urls: schema.arrayOf(schema.string(), {
    defaultValue: [
      'https://mrdata.usgs.gov/services/active-mines', // Note these servers dont actually support the cql polygon filter
      'https://mrdata.usgs.gov/services/phosphate', // Note these servers dont actually support the cql polygon filter
    ],
  }),
  enabled: schema.boolean({ defaultValue: false }),
});

export type AcecardEMSConfig = TypeOf<typeof mapConfigSchema>;
