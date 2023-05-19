/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
/* eslint-disable @typescript-eslint/naming-convention */
import React, { ReactElement } from 'react';
import { calculateBounds } from '@kbn/data-plugin/common';
import { FieldFormatter, MIN_ZOOM, MAX_ZOOM } from '@kbn/maps-plugin/common';
import type {
  AbstractSourceDescriptor,
  Attribution,
  DataFilters,
  DataRequestMeta,
  Timeslice,
} from '@kbn/maps-plugin/common/descriptor_types';
import type {
  DataRequest,
  IField,
  ImmutableSourceProperty,
  IRasterSource,
  SourceEditorArgs,
} from '@kbn/maps-plugin/public';
import { RasterTileSourceData } from '@kbn/maps-plugin/public/classes/sources/raster_source';
import { MapMouseEvent, Popup, RasterTileSource } from 'maplibre-gl';
import { parseString } from 'xml2js';
import { OnSourceChangeArgs } from '@kbn/maps-plugin/public/classes/sources/source';
import { Filter } from '@kbn/es-query';
import { AcecardEMSSettingsEditor } from './acecard_ems_editor';
import { getRotatedViewport, toWKT } from './utils';
// promise based wrapper around parseString
const XML_PARSER = new DOMParser();
export async function parseXmlString(xmlString: string): Promise<unknown> {
  const parsePromise = new Promise((resolve, reject) => {
    parseString(xmlString, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });

  return await parsePromise;
}
const TILE_SIZE = 256;
const CLICK_HANDLERS: Record<string, AcecardEMSSource> = {};
const CUSTOM_CLICKHANDLER = function CUSTOM_CLICKHANDLER(
  click: MapMouseEvent & Record<string, unknown>
) {
  // check if the map still has the source if not remove that click handler
  const sources = Object.keys(CLICK_HANDLERS);
  sources.forEach((s) => {
    if (!click.target.getSource(s)) {
      delete CLICK_HANDLERS[s]; // This isn't working because kibana doesn't clean up the sources when it deletes the layer.
    } else {
      // Hack fix for the source being orphaned
      const layers = Object.keys(click.target.style._layers)
        .map((k) => click.target.style._layers[k])
        .filter((l) => l.source === s);
      if (!layers.length) {
        window.console.log('Orphaned source Kibana fix your stuff');
        delete CLICK_HANDLERS[s];
        return;
      }
      const source: AcecardEMSSource = CLICK_HANDLERS[s];
      source.onClick(click);
    }
  });
};
export type AcecardEMSSourceDescriptor = AbstractSourceDescriptor & {
  baseUrl: string;
  layer: string;
  name: string;
  timeColumn: string;
  geoColumn: string;
};

export class AcecardEMSSource implements IRasterSource {
  static type = 'AcecardEMSSource';

  readonly _descriptor: AcecardEMSSourceDescriptor;
  private _wmsLayers?: string[];
  private _wfsLayers?: string[];

  static createDescriptor(
    baseUrl: string,
    layer: string,
    name: string
  ): AcecardEMSSourceDescriptor {
    return {
      type: AcecardEMSSource.type,
      baseUrl,
      layer,
      name,
      timeColumn: '',
      geoColumn: '',
    };
  }

  constructor(sourceDescriptor: AcecardEMSSourceDescriptor) {
    this._descriptor = sourceDescriptor;
    // Can we get the WFS info here?
  }
  async hasLegendDetails(): Promise<boolean> {
    return true;
  }

  renderLegendDetails(): ReactElement<any> | null {
    return <img alt="Radar legend" src="https://nowcoast.noaa.gov/images/legends/radar.png" />;
  }
  async canSkipSourceUpdate(
    dataRequest: DataRequest,
    nextRequestMeta: DataRequestMeta
  ): Promise<boolean> {
    const prevMeta = dataRequest.getMeta();
    window.console.log(prevMeta, nextRequestMeta);
    if (!prevMeta) {
      return false;
    }
    // Check for time changes
    if (
      this._descriptor.timeColumn !== '' &&
      JSON.stringify(prevMeta.timeslice) !== JSON.stringify(nextRequestMeta.timeslice)
    ) {
      window.console.log('Need to update because time filter');
      return false; // Time has changed lets remove the tile and update with the correct times
    }
    // Check for geo filter changes
    const data = dataRequest.getData() as RasterTileSourceData;
    if (data) {
      const newCQL = this._getGeoCQLFromFilter(
        nextRequestMeta.filters || [],
        this._descriptor.geoColumn
      ).join(' AND ');
      const url = new URL(data.url);
      const oldCQL = url.searchParams.get('cql_filter') || '';
      // FIXME If you have two polygon filters and you remove one we don't update. We need to make a CQL to Filters[] and check if the lengths are correct
      if (oldCQL.includes(newCQL) && oldCQL.includes('POLYGON') && newCQL === '') {
        window.console.log('KIBANA Polygon filter removed');
        return false;
      }
      if (
        oldCQL.includes(newCQL) &&
        oldCQL.includes('POLYGON') &&
        this._descriptor.geoColumn === ''
      ) {
        window.console.log('CQL Filter needs to be removed');
        return false;
      }
      if (!oldCQL.includes(newCQL) && newCQL.length) {
        window.console.log('CQL Filter has been added');
        return false;
      }
      if (oldCQL.includes('BETWEEN') && this._descriptor.timeColumn === '') {
        window.console.log('Time filter column removed');
        return false;
      }
    }
    return true;
  }

  async onClick(click: MapMouseEvent) {
    window.console.log(click);
    const { lng, lat } = click.lngLat;
    const min = click.target.unproject([click.point.x - 1, click.point.y]);
    const resolution = Math.abs(click.lngLat.lng - min.lng);
    const [x0, y0, x1, y1, x2, y2, x3, y3] = getRotatedViewport(
      [lng, lat],
      resolution,
      0,
      [101, 101]
    );
    const bbox = [
      Math.min(y0, y1, y2, y3),
      Math.min(x0, x1, x2, x3),
      Math.max(y0, y1, y2, y3),
      Math.max(x0, x1, x2, x3),
    ];

    const x = 50;
    const y = 50;
    const params: any = {
      format: 'image/png',
      service: 'WMS',
      version: '1.3.0',
      request: 'GetFeatureInfo',
      crs: 'EPSG:4326',
      transparent: 'true',
      width: 101,
      height: 101,
      info_format: true ? 'text/plain' : 'application/json',
      i: x,
      j: y,
      radius: 10,
      buffer: 10,
      layers: this._descriptor.layer,
      query_layers: this._descriptor.layer,
      bbox: bbox.join(','),
    };
    const url = `${this._descriptor.baseUrl}?${new URLSearchParams(params)}`;
    const featureText = await (await fetch(url)).text();
    window.console.log(featureText);
    const groups: any[] = [];
    let group: string[][] = [];
    let id = -1;
    featureText.split('\n').forEach((line) => {
      if (id === -1 && !line.includes('=')) {
        return;
      } else {
        id += 1;
      }
      if (line.includes('=')) {
        const matches = line.match(/\s*?(\w+)\s*?=\s*?['"]?(.+)/) || [];
        if (matches) {
          group.push([matches[1].trim(), matches[2].trim()]);
        }
      } else {
        groups.push(group);
        id += 1;
        group = [];
      }
    });
    if (groups.length) {
      window.console.log(groups[0]);
      new Popup()
        .setHTML(groups[0].map((e: string[]) => `${e[0]} = ${e[1]}`).join('<br>'))
        .setLngLat(click.lngLat)
        .addTo(click.target);
    }
  }
  isSourceStale(mbSource: RasterTileSource, sourceData: RasterTileSourceData): boolean {
    window.console.log(mbSource.id);
    if (!Object.keys(CLICK_HANDLERS).length) {
      // hack to get click events
      mbSource.map.on('click', CUSTOM_CLICKHANDLER);
    }
    if (CLICK_HANDLERS[mbSource.id] !== this) {
      CLICK_HANDLERS[mbSource.id] = this;
    }
    // TODO parse filters from URL and compare with _descriptor if they are different then we need to refresh
    // If the source is live we need to return true when the timer is drained
    if (!sourceData.url) {
      return false;
    }
    const currentURL = new URL(sourceData.url);
    const currentParams = Object.fromEntries(currentURL.searchParams.entries());
    const oldURL = new URL(mbSource.tiles?.[0]);
    const oldParams = Object.fromEntries(oldURL.searchParams.entries());
    window.console.log(currentParams, oldParams);
    return JSON.stringify(currentParams) !== JSON.stringify(oldParams);
  }

  cloneDescriptor(): AcecardEMSSourceDescriptor {
    return {
      ...this._descriptor,
    };
  }

  async supportsFitToBounds(): Promise<boolean> {
    return false;
  }

  /**
   * return list of immutable source properties.
   * Immutable source properties are properties that can not be edited by the user.
   */
  async getImmutableProperties(): Promise<ImmutableSourceProperty[]> {
    return [];
  }

  getType(): string {
    return this._descriptor.type;
  }

  async getDisplayName(): Promise<string> {
    return this._descriptor.name;
  }

  getAttributionProvider(): (() => Promise<Attribution[]>) | null {
    return null;
  }
  isBoundsAware(): boolean {
    return true;
  }
  isFieldAware(): boolean {
    return false;
  }

  isGeoGridPrecisionAware(): boolean {
    return false;
  }

  isQueryAware(): boolean {
    return true;
  }

  isESSource(): boolean {
    return true;
  }
  getGeoFieldName(): string {
    return this._descriptor.geoColumn;
  }

  getGeoField() {
    return this._descriptor.geoColumn;
  }
  async isTimeAware(): Promise<boolean> {
    return true;
  }

  isFilterByMapBounds(): boolean {
    return true;
  }
  getFieldNames(): string[] {
    return [];
  }

  renderSourceSettingsEditor(sourceEditorArgs: SourceEditorArgs): ReactElement<any> | null {
    return (
      <AcecardEMSSettingsEditor
        layer={this}
        descriptor={this._descriptor}
        handlePropertyChange={(settings: Partial<AcecardEMSSourceDescriptor>): void => {
          // throw new Error('Function not implemented.');
          const args = Object.entries(settings).map(
            (v) => ({ propName: v[0], value: v[1] } as OnSourceChangeArgs)
          );
          sourceEditorArgs.onChange(...args);
        }}
      />
    );
  }

  getApplyGlobalQuery(): boolean {
    return false;
  }

  getApplyGlobalTime(): boolean {
    return true;
  }

  getApplyForceRefresh(): boolean {
    return false;
  }

  getIndexPatternIds(): string[] {
    return [];
  }

  getQueryableIndexPatternIds(): string[] {
    return [];
  }

  getGeoGridPrecision(zoom: number): number {
    return 0;
  }

  // Returns function used to format value
  async createFieldFormatter(field: IField): Promise<FieldFormatter | null> {
    return null;
  }

  async getValueSuggestions(field: IField, query: string): Promise<string[]> {
    return [];
  }

  getMinZoom(): number {
    return MIN_ZOOM;
  }

  getMaxZoom(): number {
    return MAX_ZOOM;
  }

  async getLicensedFeatures(): Promise<[]> {
    return [];
  }

  getUpdateDueToTimeslice(prevMeta: DataRequestMeta, timeslice?: Timeslice): boolean {
    return true;
  }
  async _fetchCapabilities(service: string) {
    const queryParams = {
      version: '1.3.1',
      request: 'GetCapabilities',
      service,
    };
    const params = new URLSearchParams(queryParams);
    const resp = await fetch(this._descriptor.baseUrl + '?' + params);
    if (resp.status >= 400) {
      throw new Error(`Unable to access ${this._descriptor.baseUrl}`);
    }
    const body = await resp.text();
    return XML_PARSER.parseFromString(body, 'text/xml');
    // return await parseXmlString(body);
  }
  async _fetchWMSLayers() {
    const capabilities: Document = await this._fetchCapabilities('WMS');
    const capability = capabilities.getElementsByTagNameNS(
      'http://www.opengis.net/wms',
      'Capability'
    )[0];
    const names = capability.getElementsByTagNameNS('http://www.opengis.net/wms', 'Name');

    this._wmsLayers = [...names].map((n) => n.textContent || '').filter((s) => s !== '');
  }
  async _fetchWFSLayers() {
    const capabilities: Document = await this._fetchCapabilities('WFS');
    const list = capabilities.getElementsByTagNameNS(
      'http://www.opengis.net/wfs',
      'FeatureTypeList'
    )[0];
    this._wfsLayers = [...list.getElementsByTagNameNS('http://www.opengis.net/wfs', 'Name')]
      .map((n) => n.textContent || '')
      .filter((s) => s !== null && s !== '');
  }
  _getGeoCQLFromFilter(filters: Filter[], geoColumn: string) {
    const cqlStatements: string[] = [];
    filters = filters.filter((f) => f.meta.key === geoColumn);
    if (filters.length) {
      filters.forEach((filter) => {
        if (filter.query) {
          filter.query.bool.must.forEach((statement: { geo_shape: any }) => {
            if (statement.geo_shape && statement.geo_shape[geoColumn]) {
              const geo_shape = statement.geo_shape[geoColumn];
              const relation = geo_shape.relation;
              const shape = toWKT(geo_shape.shape);
              cqlStatements.push(`(${relation}(${geoColumn}, ${shape}))`);
            }
          });
        }
      });
    }
    return cqlStatements;
  }
  async getUrlTemplate(dataFilters: DataFilters): Promise<string> {
    if (!this._wmsLayers) {
      await this._fetchWMSLayers();
    }
    if (!this._wfsLayers) {
      await this._fetchWFSLayers();
    }
    if (!this._wmsLayers || !this._wmsLayers.includes(this._descriptor.layer)) {
      throw Error(`WMS server doesn't have ${this._descriptor.layer} verify WMS configuration`);
    }
    if (!this._wfsLayers || !this._wfsLayers.includes(this._descriptor.layer)) {
      throw Error(`WFS server doesn't have ${this._descriptor.layer} verify WFS configuration`);
    }
    const { timeslice, timeFilters } = dataFilters;
    let start;
    let stop;

    if (timeslice) {
      // Use the value from the timeslider
      stop = new Date(timeslice.to).toISOString();
      start = new Date(timeslice.from).toISOString();
    } else {
      const { max, min } = calculateBounds(timeFilters);
      stop = max ? max.toISOString() : Date.now();
      start = min ? min.toISOString() : undefined;
    }
    const cqlStatements: string[] = [
      ...this._getGeoCQLFromFilter(dataFilters.filters, this._descriptor.geoColumn),
    ];

    if (this._descriptor.timeColumn !== '' && start && stop) {
      cqlStatements.push(`(${this._descriptor.timeColumn} BETWEEN ${start} AND ${stop})`);
    }
    const params: any = {
      format: 'image/png',
      service: 'WMS',
      version: '1.1.1',
      request: 'GetMap',
      srs: 'EPSG:3857',
      transparent: 'true',
      width: TILE_SIZE,
      height: TILE_SIZE,
      layers: this._descriptor.layer,
      // CQL TIME FILTER TIED TO GLOBAL TIME
      // CQL BBOX FILTER TIED to geo filters
    };
    if (cqlStatements.length) {
      params.cql_filter = cqlStatements.join(' AND ');
    }

    // TODO get the time field if appropriate and POPULATE the CQL '{time}'
    return `${this._descriptor.baseUrl}?${new URLSearchParams(params)}&bbox={bbox-epsg-3857}`;
    // return NOT_SETUP;
  }
}
