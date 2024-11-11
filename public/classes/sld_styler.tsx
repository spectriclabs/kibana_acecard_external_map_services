/* eslint-disable @kbn/eslint/require-license-header */

import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Style, Rule } from 'geostyler-style';
import { EuiButton, EuiPanel, EuiAccordion } from "@elastic/eui";
import { RuleRender } from './sld';
import { WFSColumns } from './acecard_ems_editor';

interface Props {
  setStyle: (style: any) => void;
  layerName: string;
  preview: () => void;
  columns: WFSColumns[];
}

interface State {
  style: Style;
  enablePreview: boolean;
  accordion: number;
}

export const SldStyleEditor: React.FC<Props> = ({
  setStyle,
  layerName,
  columns,
  preview,
}: Props): JSX.Element => {
  const [state, setState] = useState<State>({
    style: { name: layerName, rules: [] },
    enablePreview: false,
    accordion: 0,
  });
  return (
    <div>
      {state.style.rules.map((rule, i) => (
        <EuiAccordion
          id={`rule-${i}`}
          key={`rule-${i}`}
          element="fieldset"
          buttonContent={`Style Rule #${i + 1}`}
          forceState={state.accordion === i ? 'open' : 'closed'}
          onToggle={(isOpen) => {
            if (isOpen) {
              setState({ ...state, accordion: i });
            }
          }}
        >
          <RuleRender
            columns={columns}
            rule={rule}
            onChange={(newRule: Rule) => {
              const rules = [...state.style.rules];
              rules[i] = newRule;
              setStyle({ ...state.style, rules: [...rules] });
              setState({
                ...state,
                style: { ...state.style, rules: [...rules] },
                enablePreview: true,
              });
            }}
          />
        </EuiAccordion>
      ))}
      <EuiPanel>
        <EuiButton
          onClick={() => {
            state.style.rules.push({
              name: 'Rule_' + uuid(),
              symbolizers: [],
            });
            setState({
              ...state,
              style: { ...state.style, rules: [...state.style.rules] },
              accordion: state.style.rules.length - 1,
            });
          }}
        >
          Add Custom Style Rule
        </EuiButton>
        <EuiButton
          disabled={!state.enablePreview} // If we don't have a column we cant add a filter
          onClick={() => {
            preview();
            setState({ ...state, enablePreview: false });
          }}
        >
          Preview
        </EuiButton>
      </EuiPanel>
    </div>
  );
};
