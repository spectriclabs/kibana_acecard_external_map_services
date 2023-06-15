/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
/* eslint-disable @typescript-eslint/naming-convention */
import React, { ReactElement } from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
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
import { MapMouseEvent, Popup, RasterTileSource, Map as MapboxMap } from 'maplibre-gl';
import { OnSourceChangeArgs } from '@kbn/maps-plugin/public/classes/sources/source';
import { Filter } from '@kbn/es-query';
import { AcecardEMSSettingsEditor } from './acecard_ems_editor';
import { getRotatedViewport, toWKT, parseCQL } from './utils';
import { Tooltip } from './tooltips';

const TILE_SIZE = 256;
const CLICK_HANDLERS: Record<string, AcecardEMSSource> = {};
const LIVE_SOURCE: Record<string, number> = {};
const TIMERS_MAP: Map<MapboxMap, number> = new Map();
const setRefreshTimer = (mbMap: MapboxMap) => {
  if (!TIMERS_MAP.has(mbMap)) {
    window.console.log('Setting timer');
    const timeout = window.setTimeout(() => {
      TIMERS_MAP.delete(mbMap);
      window.console.log('Sending refresh');
      mbMap.setBearing(0); // Fun little hack I found to cause kibana maps to resend filters to force a check if sources need to be updated. Doesn't change anything on the map but does what I want.
    }, 10000);
    TIMERS_MAP.set(mbMap, timeout);
  }
};
const CUSTOM_CLICKHANDLER = function CUSTOM_CLICKHANDLER(
  click: MapMouseEvent & Record<string, unknown>
) {
  // check if the map still has the source if not remove that click handler
  const sources = Object.keys(CLICK_HANDLERS);
  sources.forEach((s) => {
    const source = CLICK_HANDLERS[s];
    if (!click.target.getSource(s)) {
      source.onRemove();
      delete CLICK_HANDLERS[s]; // This isn't working because kibana doesn't clean up the sources when it deletes the layer.
    } else {
      // Hack fix for the source being orphaned
      const layers = Object.keys(click.target.style._layers)
        .map((k) => click.target.style._layers[k])
        .filter((l) => l.source === s);
      if (!layers.length) {
        window.console.log('Orphaned source Kibana fix your stuff');
        delete CLICK_HANDLERS[s];
        source.onRemove();
        return;
      }
      // HACK to check the drawstate (filter creation) Kibana doesn't pass the map state to the sources
      if (
        !click.target._listeners['draw.create'] ||
        !click.target._listeners['draw.create'].length
      ) {
        source.onClick(click);
      }
    }
  });
};
export type AcecardEMSSourceDescriptor = AbstractSourceDescriptor & {
  baseUrl: string;
  layer: string;
  name: string;
  timeColumn: string;
  geoColumn: string;
  nrt: boolean;
};

export class AcecardEMSSource implements IRasterSource {
  static type = 'AcecardEMSSource';
  readonly _popupContainer = document.createElement('div');
  readonly _descriptor: AcecardEMSSourceDescriptor;
  cql_filter: string;

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
      nrt: false,
    };
  }

  constructor(sourceDescriptor: AcecardEMSSourceDescriptor) {
    this._descriptor = sourceDescriptor;
    this.cql_filter = '';
  }
  async hasLegendDetails(): Promise<boolean> {
    return false;
  }

  renderLegendDetails(): ReactElement<any> | null {
    return null;
  }

  isSourceStale(mbSource: RasterTileSource, sourceData: RasterTileSourceData): boolean {
    window.console.log('Stale Check');
    if (!Object.keys(CLICK_HANDLERS).length) {
      // hack to get click events
      mbSource.map.on('click', CUSTOM_CLICKHANDLER);
    }
    if (CLICK_HANDLERS[mbSource.id] !== this) {
      CLICK_HANDLERS[mbSource.id] = this;
    }
    if (this._descriptor.nrt) {
      setRefreshTimer(mbSource.map);
    }
    if (this._descriptor.nrt) {
      const loaded = mbSource.map.style.sourceCaches[mbSource.id].loaded(); // Only refresh Once all tiles are loaded
      if (!loaded) {
        return false;
      }

      const refreshRate = 10 * 1000; // Wait 10 seconds
      const now = performance.now();
      if (!LIVE_SOURCE[mbSource.id]) {
        LIVE_SOURCE[mbSource.id] = now;
        return true;
      }
      if (LIVE_SOURCE[mbSource.id] && LIVE_SOURCE[mbSource.id] + refreshRate < now) {
        LIVE_SOURCE[mbSource.id] = now;
        window.console.log('Live Refresh');
        mbSource.map.style.sourceCaches[mbSource.id].reload();
        return true;
      }
    }

    // TODO If the source is live we need to return true when the timer is drained
    if (!sourceData.url) {
      return false;
    }
    const currentURL = new URL(sourceData.url);
    const currentParams = Object.fromEntries(currentURL.searchParams.entries());
    const oldURL = new URL(mbSource.tiles?.[0]);
    const oldParams = Object.fromEntries(oldURL.searchParams.entries());
    if (currentParams.cql_filter && currentParams.cql_filter !== '') {
      this.cql_filter = currentParams.cql_filter;
    }
    const stale = JSON.stringify(currentParams) !== JSON.stringify(oldParams);
    if (stale) {
      window.console.log('Stale rebuilding urltemplate');
    }
    return stale;
  }

  async canSkipSourceUpdate(
    dataRequest: DataRequest,
    nextRequestMeta: DataRequestMeta
  ): Promise<boolean> {
    const prevMeta = dataRequest.getMeta();
    if (!prevMeta) {
      return false;
    }

    if (this._descriptor.nrt) {
      // We are real time source so we always need to update
      return false;
    }
    if (
      this._descriptor.timeColumn !== '' &&
      (JSON.stringify(prevMeta.timeslice) !== JSON.stringify(nextRequestMeta.timeslice) ||
        JSON.stringify(prevMeta.timeFilters) !== JSON.stringify(nextRequestMeta.timeFilters))
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
      );
      const url = new URL(data.url);
      const oldCQL = parseCQL(url.searchParams.get('cql_filter') || '');
      const oldSpatial = oldCQL.filter((f) => f.meta.spatial).map((f) => f.cql);
      const oldTime = oldCQL.filter((f) => !f.meta.spatial).map((f) => f.cql);
      if (oldSpatial.length !== newCQL.length) {
        window.console.log('KIBANA spatial filter change');
        return false;
      }
      for (const index in oldSpatial) {
        if (oldSpatial[index] !== newCQL[index]) {
          return false; // Something changed (negating the filter or edit of the DSL)
        }
      }
      if (oldTime.includes('BETWEEN') && this._descriptor.timeColumn === '') {
        window.console.log('Time filter column removed');
        return false;
      }
    }
    return true;
  }
  async onRemove() {
    // This should trigger componentWillUnmount() so any tooltips that did anything special to the map can remove that
    unmountComponentAtNode(this._popupContainer);
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
    if (this.cql_filter.length) {
      params.cql_filter = this.cql_filter;
    }
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
      const container = this._popupContainer;
      render(
        <>
          <Tooltip
            wmsBase={this._descriptor.baseUrl}
            layer={this._descriptor.layer}
            keypair={groups[0]}
            map={click.target}
          />
        </>,
        container
      );
      new Popup().setDOMContent(container).setLngLat(click.lngLat).addTo(click.target);
    }
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
    return this._descriptor.geoColumn !== ''; // Only show bounding box filters when Geo column is selected
  }
  getGeoFieldName(): string {
    return this._descriptor.geoColumn;
  }

  getGeoField() {
    return this._descriptor.geoColumn;
  }
  async isTimeAware(): Promise<boolean> {
    return this._descriptor.timeColumn !== ''; // Only show timeslider when we are time aware
  }

  isFilterByMapBounds(): boolean {
    return true;
  }
  getFieldNames(): string[] {
    return [];
  }
  // FIXME? will we need to change this at runtime? if not move it to the acecard_ems_editor
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

  _getGeoCQLFromFilter(filters: Filter[], geoColumn: string) {
    const cqlStatements: string[] = [];
    filters = filters.filter(
      (f) => f.meta.key === geoColumn || f.meta.isMultiIndex || f.meta.type === 'custom'
    );
    if (filters.length) {
      filters.forEach((filter) => {
        const queries = [];
        if (filter.meta.disabled) {
          return;
        }
        if (filter.meta.isMultiIndex && filter.query) {
          filter.query.bool.should.forEach((q: any) => queries.push(q));
        } else if (filter.query) {
          if (filter.query.bool.should) {
            filter.query.bool.should.forEach((q: any) => queries.push(q));
          } else {
            queries.push(filter.query);
          }
        }
        if (queries.length) {
          const negate = filter.meta.negate ? 'NOT ' : '';
          queries.forEach((query) => {
            query.bool.must.forEach((statement: { geo_shape?: any; geo_distance?: any }) => {
              // HANDLE GEOSHAPE queries
              if (statement.geo_shape && statement.geo_shape[geoColumn]) {
                const geo_shape = statement.geo_shape[geoColumn];
                const relation = geo_shape.relation;
                const shape = toWKT(geo_shape.shape);
                cqlStatements.push(`(${negate}${relation}(${geoColumn}, ${shape}))`);
              }
              // HANDLE GEODISTANCE qureies DWITHIN(GEOM,Point(-60.2 46.1),0.05,kilometers)
              // {"geo_distance":{"distance":"320km","the_geom":[-91.11,37.69]}}
              if (statement.geo_distance && statement.geo_distance[geoColumn]) {
                // check if point then make geojson point else use the geojson shape
                const geo_shape =
                  Array.isArray(statement.geo_distance[geoColumn]) &&
                  statement.geo_distance[geoColumn].length === 2
                    ? { shape: { type: 'Point', coordinates: statement.geo_distance[geoColumn] } }
                    : statement.geo_distance[geoColumn];
                const shape = toWKT(geo_shape.shape);
                const relation = 'DWITHIN';
                const match = statement.geo_distance.distance.match(/([\d.]+)(\w+)/);
                const distance = match[1];
                const units = match[2] === 'km' ? 'kilometers' : 'meters';
                cqlStatements.push(
                  `(${negate}${relation}(${geoColumn}, ${shape},${distance},${units}))`
                );
              }
            });
          });
        }
      });
    }
    return cqlStatements;
  }

  // FIXME create CQL filter from DSL filter dataFilters.sourceQuery they patched this is 8.8.0 to pass it down correctly.
  async getUrlTemplate(dataFilters: DataFilters): Promise<string> {
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
    return `${this._descriptor.baseUrl}?${new URLSearchParams(params)}&bbox={bbox-epsg-3857}`;
    // return NOT_SETUP;
  }
}
