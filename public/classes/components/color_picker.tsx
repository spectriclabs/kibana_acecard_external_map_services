/* eslint-disable @kbn/eslint/require-license-header */
import React from 'react';

import { EuiColorPicker, EuiFormRow } from '@elastic/eui';

interface ColorOpacityValue {
  color: string;
  opacity: number;
}

export const ColorPicker = ({
  label,
  color,
  opacity,
  onChange,
}: {
  label: string;
  color: string;
  opacity: number;
  onChange: (color: ColorOpacityValue) => void;
}) => {
  const opacityHex = Math.round(((opacity as number) || 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return (
    <EuiFormRow label={label}>
      <EuiColorPicker
        showAlpha={true}
        color={color ? color + opacityHex : '#FF0000FF'}
        onChange={(colorHex) => {
          const newColor = colorHex.substring(0, 7);
          const newOpacity = parseInt(colorHex.substring(7, 7 + 2) || 'FF', 16) / 255;
          onChange({ color: newColor, opacity: newOpacity });
        }}
      />
    </EuiFormRow>
  );
};
