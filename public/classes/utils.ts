/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export const toWKT = (geoJSON: { [x: string]: any; type: string; geometry: any }) => {
  if (geoJSON.type === 'Feature') {
    geoJSON = geoJSON.geometry;
  }

  function pairWKT(c: any[]) {
    return c.join(' ');
  }

  function ringWKT(r: any[]) {
    return r.map(pairWKT).join(', ');
  }

  function ringsWKT(r: any[]) {
    return r.map(ringWKT).map(wrapParens).join(', ');
  }

  function multiRingsWKT(r: any[]) {
    return r.map(ringsWKT).map(wrapParens).join(', ');
  }

  function wrapParens(s: string) {
    return '(' + s + ')';
  }

  const gJ = geoJSON;
  switch (gJ.type) {
    case 'Point':
      if (gJ.coordinates && gJ.coordinates.length === 3)
        return 'POINT Z (' + pairWKT(gJ.coordinates) + ')';
      else return 'POINT (' + pairWKT(gJ.coordinates) + ')';

    case 'LineString':
      if (gJ.coordinates && gJ.coordinates[0] && gJ.coordinates[0].length === 3)
        return 'LINESTRING Z (' + ringWKT(gJ.coordinates) + ')';
      else return 'LINESTRING (' + ringWKT(gJ.coordinates) + ')';

    case 'Polygon':
      if (
        gJ.coordinates &&
        gJ.coordinates[0] &&
        gJ.coordinates[0][0] &&
        gJ.coordinates[0][0].length === 3
      )
        return 'POLYGON Z (' + ringsWKT(gJ.coordinates) + ')';
      else return 'POLYGON (' + ringsWKT(gJ.coordinates) + ')';

    case 'MultiPoint':
      if (gJ.coordinates && gJ.coordinates[0] && gJ.coordinates[0].length === 3)
        return 'MULTIPOINT Z (' + ringWKT(gJ.coordinates) + ')';
      else return 'MULTIPOINT (' + ringWKT(gJ.coordinates) + ')';

    case 'MultiLineString':
      if (
        gJ.coordinates &&
        gJ.coordinates[0] &&
        gJ.coordinates[0][0] &&
        gJ.coordinates[0][0].length === 3
      )
        return 'MULTILINESTRING Z (' + ringsWKT(gJ.coordinates) + ')';
      else return 'MULTILINESTRING (' + ringsWKT(gJ.coordinates) + ')';

    case 'MultiPolygon':
      if (
        gJ.coordinates &&
        gJ.coordinates[0] &&
        gJ.coordinates[0][0] &&
        gJ.coordinates[0][0] &&
        gJ.coordinates[0][0][0].length === 3
      )
        return 'MULTIPOLYGON Z (' + multiRingsWKT(gJ.coordinates) + ')';
      else return 'MULTIPOLYGON (' + multiRingsWKT(gJ.coordinates) + ')';

    case 'GeometryCollection':
      return 'GEOMETRYCOLLECTION (' + gJ.geometries.map(toWKT).join(', ') + ')';

    default:
      throw new Error('stringify requires a valid GeoJSON Feature or geometry object as input');
  }
};

export function getRotatedViewport(
  center: number[],
  resolution: number,
  rotation: number,
  size: number[]
) {
  const dx = (resolution * size[0]) / 2;
  const dy = (resolution * size[1]) / 2;
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);
  const xCos = dx * cosRotation;
  const xSin = dx * sinRotation;
  const yCos = dy * cosRotation;
  const ySin = dy * sinRotation;
  const x = center[0];
  const y = center[1];
  return [
    x - xCos + ySin,
    y - xSin - yCos,
    x - xCos - ySin,
    y - xSin + yCos,
    x + xCos - ySin,
    y + xSin + yCos,
    x + xCos + ySin,
    y + xSin - yCos,
    x - xCos + ySin,
    y - xSin - yCos,
  ];
}
