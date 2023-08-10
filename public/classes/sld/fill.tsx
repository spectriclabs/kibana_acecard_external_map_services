import React from "react";
import { WFSColumns } from "../acecard_ems_editor";
import { ColorPicker } from "../components/color_picker";
import { FillSymbolizer } from 'geostyler-style';
export const FillRender = ({
    symbol,
    onChange,
    columns,
  }: {
    symbol: FillSymbolizer;
    onChange: (symbol: FillSymbolizer) => void;
    columns: WFSColumns[];
  }) => {
    return (
      <div>
        <ColorPicker
          label={'Polygon Fill Color'}
          color={(symbol.color as string) || '#FF0000'}
          opacity={(symbol.fillOpacity as number) || 1}
          onChange={({ color, opacity }) => {
            onChange({ ...symbol, color, fillOpacity: opacity });
          }}
        />
        <ColorPicker
          label={'Polygon Outline Color'}
          color={(symbol.outlineColor as string) || '#FF0000'}
          opacity={(symbol.outlineOpacity as number) || 1}
          onChange={({ color, opacity }) => {
            onChange({ ...symbol, outlineColor: color, outlineOpacity: opacity });
          }}
        />
      </div>
    );
  };