import _ from 'lodash/fp'
import { div, h, span } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { Link, Select } from 'src/components/common'
import { InputSourceSelect } from 'src/components/submission-common'
import { FlexTable, HeaderCell, TextCell } from 'src/components/table'
import * as Utils from 'src/libs/utils'


export const StructBuilder = props => {
  const {
    structBuilderData,
    inputSourceTypes, inputSourceLabels,
    structBuilderPathComponents, setStructBuilderPathComponents,
    configuredInputDefinition, setConfiguredInputDefinition
  } = props

  console.log('structBuilderData', structBuilderData)
  const structBuilderFields = structBuilderData.input_type.fields

  const breadcrumbsHeight = 35
  // const structBuilderPath

  return h(div, { style: { height: 500 } }, [
    h(div, {
      style: {
        height: breadcrumbsHeight,
        fontSize: 15,
        display: 'flex',
        alignItems: 'center'
      }
    }, [
      h(TextCell, {}, [
        h(Link, {}, `myStruct`),
        h(span, {}, ' / '),
        h(Link, { onClick: () => console.log('clicked species') }, `species`)
      ])
    ]),
    h(AutoSizer, [({ width, height }) => {
      return h(FlexTable, {
        'aria-label': 'struct-table',
        rowCount: 2,
        readOnly: false,
        height: height - breadcrumbsHeight,
        width,
        columns: [
          {
            size: { basis: 250, grow: 0 },
            field: 'struct',
            headerRenderer: () => h(HeaderCell, ['Struct']),
            cellRenderer: ({ rowIndex }) => {
              return h(TextCell, { style: { fontWeight: 500 } }, [structBuilderData.variable])
            }
          },
          {
            size: { basis: 160, grow: 0 },
            field: 'field',
            headerRenderer: () => h(HeaderCell, ['Field']),
            cellRenderer: ({ rowIndex }) => {
              return h(TextCell, { }, [structBuilderFields[rowIndex].field_name])
            }
          },
          {
            size: { basis: 160, grow: 0 },
            field: 'type',
            headerRenderer: () => h(HeaderCell, ['Type']),
            cellRenderer: ({ rowIndex }) => {
              return h(TextCell, {}, [Utils.renderTypeText(structBuilderFields[rowIndex].field_type)])
            }
          },
          {
            size: { basis: 350, grow: 0 },
            headerRenderer: () => h(HeaderCell, ['Input sources']),
            cellRenderer: ({ rowIndex }) => {
              return InputSourceSelect({
                inputDefinitionIndex: rowIndex,
                source: _.get(`source.fields.[${rowIndex}].source`, structBuilderData),
                inputType: _.get(`input_type.fields.[${rowIndex}].field_type.type`, structBuilderData),
                update: newSource => console.log(`updating ${rowIndex}:`, newSource)
              })
            }
          },
          {
            headerRenderer: () => h(HeaderCell, ['Attribute']),
            cellRenderer: ({ rowIndex }) => {
              const source = _.get(`source`, structBuilderData)
              const isStruct = structBuilderFields[rowIndex].field_type.type === 'struct'
              // return Utils.switchCase(source.type || 'none',
              //   ['record_lookup', () => recordLookupSelect(rowIndex)],
              //   ['literal', () => isStruct ? structBuilderSelect(rowIndex) : parameterValueSelect(rowIndex)],
              //   ['none', () => h(TextCell, { style: { fontStyle: 'italic' } }, ['Optional'])]
              // )
              return h(TextCell, { style: { fontStyle: 'italic' } }, [`<attribute ${rowIndex}>, <isStruct: ${isStruct}>`])
            }
          }
        ]
      })
    }])
  ])
}
