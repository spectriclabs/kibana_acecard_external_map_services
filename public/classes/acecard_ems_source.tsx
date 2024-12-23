/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
/* eslint-disable @typescript-eslint/naming-convention */
import React, { Fragment, ReactElement, } from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { EuiFormRow, EuiSelect, EuiTitle, EuiPanel, EuiSpacer } from '@elastic/eui';

import { calculateBounds, DataView } from '@kbn/data-plugin/common';
import { FieldFormatter, MIN_ZOOM, MAX_ZOOM, VECTOR_SHAPE_TYPE } from '@kbn/maps-plugin/common';
import { Style } from 'geostyler-style';
import SLDParser from 'geostyler-sld-parser';
import type {
  AbstractSourceDescriptor,
  Attribution,
  DataFilters,
  DataRequestMeta,
  DynamicStylePropertyOptions,
  MapExtent,
  SourceRequestMeta,
  StyleMetaData,
  Timeslice,
  TooltipFeatureAction,
  VectorSourceRequestMeta,
} from '@kbn/maps-plugin/common/descriptor_types';
import type {
  BoundsRequestMeta,
  DataRequest,
  GeoJsonWithMeta,
  GetFeatureActionsArgs,
  IField,
  ImmutableSourceProperty,
  IRasterSource,
  ITooltipProperty,
  SourceEditorArgs,
  SourceStatus,
} from '@kbn/maps-plugin/public';
import { RasterTileSourceData } from '@kbn/maps-plugin/public/classes/sources/raster_source';
import { MapMouseEvent, Popup, RasterTileSource, Map as MapboxMap } from 'maplibre-gl';
import { Filter, Query, TimeRange, fromKueryExpression } from '@kbn/es-query';
import { toCql } from './ast';
import { getRotatedViewport, toWKT, parseCQL } from './utils';
import { MultiLayerToolTip, Tooltip } from './tooltips';
import { getIsDarkMode } from '../config';
import { WFSColumns } from './acecard_ems_editor';
import { IESSource } from '@kbn/maps-plugin/public/classes/sources/es_source/types';
import { KibanaExecutionContext } from '@kbn/core-execution-context-common';
import { Adapters } from '@kbn/inspector-plugin/common';
import { IDynamicStyleProperty } from '@kbn/maps-plugin/public/classes/styles/vector/properties/dynamic_style_property';
import { IVectorStyle } from '@kbn/maps-plugin/public/classes/styles/vector/vector_style';
import { SearchResponseWarning } from '@kbn/search-response-warnings';
import { AddTooltipFieldPopover } from './components/add_tooltip_field_popover';
const sldParser = new SLDParser();
const TILE_SIZE = 256;
const CLICK_HANDLERS: Record<string, AcecardEMSSource> = {};
const LIVE_SOURCE: Record<string, number> = {};
const TIMERS_MAP: Map<MapboxMap, number> = new Map();
export interface TooltipDescriptor {
  name: string;
  element: JSX.Element;
}
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
  // @ts-ignore
  if (!click.target._acecardToolTipContainer) {
    // @ts-ignore
    click.target._acecardToolTipContainer = document.createElement('div');
  }
  // @ts-ignore
  const container = click.target._acecardToolTipContainer;
  const sources = Object.keys(CLICK_HANDLERS);
  const tipPromises: Array<Promise<TooltipDescriptor>> = [];
  sources.forEach((s) => {
    const source = CLICK_HANDLERS[s];
    // FIXME make it so you have a layer selector step if there are multiple layers that return data from the click
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
        if (layers[0].visibility === 'visible') {
          // Ensure Layer is visible
          tipPromises.push(source.onClick(click));
        }
      }
    }
  });
  const popupClasses = getIsDarkMode()
    ? 'acecard-map-popup acecard-map-popup-dark'
    : 'acecard-map-popup';
  const popup = new Popup({ className: popupClasses })
    .setDOMContent(container)
    .setLngLat(click.lngLat);

  render(<MultiLayerToolTip promises={tipPromises} click={click} popup={popup} />, container);
};

export type AcecardEMSSourceDescriptor = AbstractSourceDescriptor & {
  baseUrl: string;
  layer: string;
  name: string;
  timeColumn: string;
  geoColumn: string;
  nrt: boolean;
  sldBody?: Style;
  tooltipProperties?:string[];
  wfsColumns?: WFSColumns[];
};

export class AcecardEMSSource implements IRasterSource, IESSource {
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
  getId(): string {
    return "";
  }


  async getIndexPattern(): Promise<DataView> {
    
    let columns = this._descriptor.wfsColumns ||[]
    const fields:any = {}
    columns.forEach(c=>{
      fields[c.name] = {
        searchable: true, aggregatable: false, name: c.name, type: c.localType
      }
    })
    //@ts-ignore
    return new DataView({
      spec:
      {
        fields
      }
    })
  }
  
  getIndexPatternId(): string {
    throw new Error('Method not implemented.');
  }
  loadStylePropsMeta({ layerName, style, dynamicStyleProps, registerCancelCallback, sourceQuery, timeFilters, searchSessionId, inspectorAdapters, executionContext, }: { layerName: string; style: IVectorStyle; dynamicStyleProps: Array<IDynamicStyleProperty<DynamicStylePropertyOptions>>; registerCancelCallback: (callback: () => void) => void; sourceQuery?: Query; timeFilters: TimeRange; searchSessionId?: string; inspectorAdapters: Adapters; executionContext: KibanaExecutionContext; }): Promise<{ styleMeta: StyleMetaData; warnings: SearchResponseWarning[]; }> {
    throw new Error('Method not implemented.');
  }
  isMvt(): boolean {
    return false;
  }
  canShowTooltip():boolean{
    return true
  }
  async getTooltipProperties(properties: any, executionContext: KibanaExecutionContext): Promise<ITooltipProperty[]> {
    return []
  }
  getBoundsForFilters(layerDataFilters: BoundsRequestMeta, registerCancelCallback: (callback: () => void) => void): Promise<MapExtent | null> {
    throw new Error('Method not implemented.');
  }
  getGeoJsonWithMeta(layerName: string, requestMeta: VectorSourceRequestMeta, registerCancelCallback: (callback: () => void) => void, isRequestStillActive: () => boolean, inspectorAdapters: Adapters): Promise<GeoJsonWithMeta> {
    throw new Error('Method not implemented.');
  }
  getFields(): Promise<IField[]> {
    throw new Error('Method not implemented.');
  }
  getFieldByName(fieldName: string): IField | null {
    throw new Error('Method not implemented.');
  }
  getLeftJoinFields(): Promise<IField[]> {
    throw new Error('Method not implemented.');
  }
  supportsJoins(): boolean {
    return false
  }
  getSyncMeta(dataFilters: DataFilters): object | null {
    throw new Error('Method not implemented.');
  }
  hasTooltipProperties(): boolean {
    return true
  }
  getSupportedShapeTypes(): Promise<VECTOR_SHAPE_TYPE[]> {
    throw new Error('Method not implemented.');
  }
  getSourceStatus(sourceDataRequest?: DataRequest): SourceStatus {
    throw new Error('Method not implemented.');
  }
  async getTimesliceMaskFieldName(): Promise<string | null> {
    return null
  }
  async supportsFeatureEditing(): Promise<boolean> {
    return false
  }
  addFeature(geometry: any): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deleteFeature(featureId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getFeatureActions({ addFilters, featureId, geoFieldNames, getActionContext, getFilterActions, getGeojsonGeometry, mbFeature, onClose, }: GetFeatureActionsArgs): TooltipFeatureAction[] {
    throw new Error('Method not implemented.');
  }
  getInspectorRequestIds(): string[] {
    return [];
  }
  async hasLegendDetails(): Promise<boolean> {
    return false;
  }

  renderLegendDetails(): ReactElement<any> | null {
    return null;
  }

  isSourceStale(mbSource: RasterTileSource, sourceData: RasterTileSourceData): boolean {
    window.console.log('Stale Check');
    if (mbSource.map._listeners.click.indexOf(CUSTOM_CLICKHANDLER) === -1) {
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
    if (!prevMeta.sourceQuery && nextRequestMeta.sourceQuery) {
      // On layer first creation there will never be a source query, but if one is added we need to refresh
      return false;
    }
    // Check if the layer specific filters have changed since last time
    if (
      prevMeta.sourceQuery &&
      nextRequestMeta.sourceQuery &&
      JSON.stringify(prevMeta.sourceQuery) !== JSON.stringify(nextRequestMeta.sourceQuery)
    ) {
      window.console.log('Updating because Layer filters changed');
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
      // const container = this._popupContainer;
      const tooltipElement = (
        <>
          <Tooltip
            wmsBase={this._descriptor.baseUrl}
            layer={this._descriptor.layer}
            keypair={groups[0]}
            tooltipProperties={this._descriptor.tooltipProperties}
            map={click.target}
          />
        </>
      ); /*
      render(
        tooltipElement,
        container
      );
      const popupClasses = getIsDarkMode()
        ? 'acecard-map-popup acecard-map-popup-dark'
        : 'acecard-map-popup';
      new Popup({ className: popupClasses })
        .setDOMContent(container)
        .setLngLat(click.lngLat)
        .addTo(click.target);*/
      return { name: this._descriptor.name, element: tooltipElement };
    }
    // eslint-disable-next-line no-throw-literal
    throw 'No Data found';
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
    return <Fragment>
          <EuiPanel>
        <EuiTitle size="xs">
          <h5>
            Tooltip fields
          </h5>
        </EuiTitle>
        <AddTooltipFieldPopover             
            onChange={sourceEditorArgs.onChange}
            descriptor={this._descriptor}
          ></AddTooltipFieldPopover>
        </EuiPanel>
        <EuiSpacer size="s" />

    </Fragment>;
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
          if (filter.query.bool.should) {
            filter.query.bool.should.forEach((q: any) => queries.push(q));
          } else {
            queries.push(filter.query);
          }
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
  _getCQLFromSourceFilter(sourceQuery: Query | undefined) {
    /*
    Convert source query to CQL
    {
        "query": "name:'mil'",
        "language": "kuery"
    }
    */
    if (sourceQuery && sourceQuery.language === 'kuery') {
      const kueryNode = fromKueryExpression(sourceQuery.query);
      return `(${toCql(kueryNode)})`;
    }
    return '';
  }
  // FIXME create CQL filter from DSL filter dataFilters.sourceQuery they patched this is 8.8.0 to pass it down correctly.
  async getUrlTemplate(dataFilters: SourceRequestMeta): Promise<string> {
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
    if (dataFilters.sourceQuery) {
      cqlStatements.push(this._getCQLFromSourceFilter(dataFilters.sourceQuery));
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
    };
    if (this._descriptor.sldBody) {
      params.style = 'style_sld_body';
      const { output } = await sldParser.writeStyle(this._descriptor.sldBody);

      params.sld_body = output;
    }
    if (cqlStatements.length) {
      params.cql_filter = cqlStatements.join(' AND ');
    }
    return `${this._descriptor.baseUrl}?${new URLSearchParams(params)}&bbox={bbox-epsg-3857}`;
    // return NOT_SETUP;
  }
}
