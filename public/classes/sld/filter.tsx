import {
    Filter,
    CombinationOperator,
    ComparisonOperator,
    ComparisonFilter,
  } from 'geostyler-style';
  
  import {
    EuiButton,
    EuiComboBox,
    EuiFlexGroup,
    EuiFlexItem,
    EuiPanel,
    EuiFieldText,
  } from '@elastic/eui';
import React, { useState } from 'react';
import { WFSColumns } from '../acecard_ems_editor';


const SingleFilter = ({
    filter,
    onChange,
    columns,
  }: {
    filter: any[];
    onChange: (filter: Filter) => void;
    columns: WFSColumns[];
  }) => {
    const columnOptions = columns.map((col) => ({ label: col.name, value: col.name }));
    const comparisonOperators = ['==', '*=', '!=', '<', '<=', '>', '>='];
    const operationOptions = [
      { label: 'Equal To', value: '==' },
      { label: 'Not Equal To', value: '!=' },
      { label: 'Like', value: '*=' },
      { label: '<', value: '<' },
      { label: '<=', value: '<=' },
      { label: '>', value: '>' },
      { label: '>=', value: '>=' },
    ];
  
    return (
      <>
        <EuiFlexGroup gutterSize="none">
          <EuiFlexItem grow={true}>
            <EuiComboBox
              placeholder={'Column'}
              singleSelection={true}
              options={columnOptions}
              isClearable={false}
              onChange={(e) => {
                const value = e.length ? e[0].value || '' : '';
                onChange([filter[0], value, filter[2]]);
              }}
              selectedOptions={[{ label: filter[1] as string, value: filter[1] as string }]}
            />
          </EuiFlexItem>
          <EuiFlexItem grow={true}>
            <EuiComboBox
              placeholder={'Operation'}
              singleSelection={true}
              options={operationOptions}
              isClearable={false}
              onChange={(e) => {
                const value = e.length ? e[0].value || '' : '';
                if (comparisonOperators.includes(value)) {
                  onChange([value as ComparisonOperator, filter[1], filter[2]]);
                }
              }}
              selectedOptions={[{ label: filter[0] as string, value: filter[0] as string }]}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiFieldText
          value={filter[2]}
          onChange={(e) => {
            const value = e.target.value;
            onChange([filter[0], filter[1], value]);
          }}
        />
      </>
    );
  };
  export const FilterEditor = ({
    filter,
    onChange,
    columns,
  }: {
    filter: Filter | undefined;
    onChange: (filter: Filter) => void;
    columns: WFSColumns[];
  }) => {
    const column = columns.find((c) => c.localType === 'string' || c.localType === 'number');
    const firstColumn = column ? column.name : false;
    let filters;
    const operators = ['||', '&&'];
    const operatorNames = ['AND', 'OR'];
    if (filter) {
      const filterArray = filter as any[];
      const operator = filterArray[0];
      if (operators.includes(operator)) {
        filters = filterArray.slice(1);
      } else {
        filters = [filterArray];
      }
    }
    const [state, setState] = useState<{ filters: ComparisonFilter[] | any[]; operator: number }>({
      filters: [],
      operator: 0,
    });
    const ouputFilter = () => {
      if (state.filters.length === 1) {
        onChange(state.filters[0]);
      }
      if (state.filters.length > 1) {
        onChange([operators[state.operator] as CombinationOperator, ...state.filters]);
      }
    };
    // s.rules[0].filter = [ '||', ['==', 'id', 'value'],['==', 'id', 'test']]
    return (
      <EuiPanel>
        <EuiButton
          disabled={!firstColumn} // If we don't have a column we cant add a filter
          onClick={() => {
            const newFilters = [...state.filters, ['==', firstColumn, 'value']];
            setState({ ...state, filters: newFilters });
            ouputFilter();
          }}
        >
          Add Style Condition
        </EuiButton>
        <EuiButton
          onClick={() => {
            setState({ ...state, operator: state.operator === 0 ? 1 : 0 });
            ouputFilter();
          }}
        >
          {operatorNames[state.operator]}
        </EuiButton>
        {state.filters.map((f, i) => {
          return (
            <SingleFilter
              filter={f}
              columns={columns}
              onChange={(newFilter) => {
                state.filters[i] = newFilter;
                setState({ ...state });
                ouputFilter();
              }}
            />
          );
        })}
      </EuiPanel>
    );
  };
  