/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import type { Map as MapboxMap } from '@kbn/mapbox-gl';
import { MapsPluginSetup, MapsPluginStart } from '@kbn/maps-plugin/public/plugin';
import { ReactElement } from 'react';

export interface AcecardExternalMapsSourcePluginSetup {
  maps: MapsPluginSetup;
}
export interface AcecardExternalMapsSourcePluginStart {
  maps: MapsPluginStart;
}
export interface KeyPair {
  0: string;
  1: string;
}
export type TooltipHandler = (
  wmsBase: string,
  layer: string,
  keypair: KeyPair[],
  map: MapboxMap
) => ReactElement<any> | null;
export interface AcecardExternalMapsSetupApi {
  registerTootipHandler(tooltipHandler: TooltipHandler): void;
}
