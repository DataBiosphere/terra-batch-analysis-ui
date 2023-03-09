import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { Link } from 'src/components/common'
import { icon } from 'src/components/icons'
import {
  inputSourceLabels,
  InputSourceSelect,
  inputSourceTypes,
  ParameterValueTextInput,
  parseMethodString,
  RecordLookupSelect,
  StructBuilderLink
} from 'src/components/submission-common'
import { FlexTable, HeaderCell, Sortable, TextCell } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import colors from 'src/libs/colors'
import * as Utils from 'src/libs/utils'
import { StructBuilderModal } from 'src/pages/StructBuilderModal'


const InputsTable = props => {
  const {
    selectedDataTable,
    configuredInputDefinition, setConfiguredInputDefinition,
    inputTableSort, setInputTableSort,
    missingRequiredInputs, missingExpectedAttributes
  } = props

  const [structBuilderVisible, setStructBuilderVisible] = useState(false)
  const [structBuilderRowIndex, setStructBuilderRowIndex] = useState(null)

  const dataTableAttributes = _.keyBy('name', selectedDataTable.attributes)

  console.log('configuredInputDefinition', configuredInputDefinition)
  const inputTableData = _.flow(
    _.entries,
    _.map(([index, row]) => {
      console.log('row.input_name', row.input_name)
      const { workflow, call, variable } = parseMethodString(row.input_name)
      return _.flow([
        _.set('taskName', call || workflow || ''),
        _.set('variable', variable || ''),
        _.set('inputTypeStr', Utils.renderTypeText(row.input_type)),
        _.set('configurationIndex', parseInt(index))
      ])(row)
    }),
    _.orderBy([({ [inputTableSort.field]: field }) => _.lowerCase(field)], [inputTableSort.direction])
  )(configuredInputDefinition)

  console.log('inputTableData', inputTableData)

  const recordLookupWithWarnings = rowIndex => {
    const currentInputName = _.get(`${rowIndex}.input_name`, inputTableData)

    return div({ style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: '0.5rem', paddingBottom: '0.5rem' } }, [
      RecordLookupSelect({
        source: _.get(`${inputTableData[rowIndex].configurationIndex}.source`, configuredInputDefinition),
        dataTableAttributes,
        update: updateInputSource(`${inputTableData[rowIndex].configurationIndex}.source`)
      }),
      missingRequiredInputs.includes(currentInputName) && h(TooltipTrigger, { content: 'This attribute is required' }, [
        icon('error-standard', {
          size: 14, style: { marginLeft: '0.5rem', color: colors.warning(), cursor: 'help' }
        })
      ]),
      missingExpectedAttributes.includes(currentInputName) && h(TooltipTrigger, { content: 'This attribute doesn\'t exist in data table' }, [
        icon('error-standard', {
          size: 14, style: { marginLeft: '0.5rem', color: colors.warning(), cursor: 'help' }
        })
      ])
    ])
  }

  const parameterValueSelect = rowIndex => {
    return ParameterValueTextInput({
      // inputDefinitionIndex: rowIndex,
      source: _.get(`${inputTableData[rowIndex].configurationIndex}.source`, configuredInputDefinition),
      update: updateInputSource(`${inputTableData[rowIndex].configurationIndex}.source`)
    })
  }

  const structBuilderLink = rowIndex => {
    return h(StructBuilderLink, {
      structBuilderVisible,
      onClick: () => {
        setStructBuilderVisible(true)
        setStructBuilderRowIndex(rowIndex)
      }
    })
  }

  const updateInputSource = sourcePath => source => {
    console.log('updateInputSource', sourcePath, source)
    setConfiguredInputDefinition(_.set(sourcePath, source, configuredInputDefinition))
  }

  return h(AutoSizer, [({ width, height }) => {
    return h(div, {}, [
      structBuilderVisible ? h(StructBuilderModal, {
        structBuilderName: inputTableData[structBuilderRowIndex].variable,
        structBuilderSource: inputTableData[structBuilderRowIndex].source,
        structBuilderInputType: inputTableData[structBuilderRowIndex].input_type,
        inputSourceTypes,
        inputSourceLabels,
        dataTableAttributes,
        updateSource: updateInputSource(`[${structBuilderRowIndex}].source`),
        onDismiss: () => {
          setStructBuilderVisible(false)
          setStructBuilderRowIndex(null)
        }
      }) : null,
      h(FlexTable, {
        'aria-label': 'input-table',
        rowCount: inputTableData.length,
        sort: inputTableSort,
        readOnly: false,
        height,
        width,
        columns: [
          {
            size: { basis: 250, grow: 0 },
            field: 'taskName',
            headerRenderer: () => h(Sortable, { sort: inputTableSort, field: 'taskName', onSort: setInputTableSort }, [h(HeaderCell, ['Task name'])]),
            cellRenderer: ({ rowIndex }) => {
              return h(TextCell, { style: { fontWeight: 500 } }, [inputTableData[rowIndex].taskName])
            }
          },
          {
            size: { basis: 360, grow: 0 },
            field: 'variable',
            headerRenderer: () => h(Sortable, { sort: inputTableSort, field: 'variable', onSort: setInputTableSort }, [h(HeaderCell, ['Variable'])]),
            cellRenderer: ({ rowIndex }) => {
              return h(TextCell, { style: Utils.typeStyle(inputTableData[rowIndex].input_type) }, [inputTableData[rowIndex].variable])
            }
          },
          {
            size: { basis: 160, grow: 0 },
            field: 'inputTypeStr',
            headerRenderer: () => h(HeaderCell, ['Type']),
            cellRenderer: ({ rowIndex }) => {
              return h(TextCell, { style: Utils.typeStyle(inputTableData[rowIndex].input_type) }, [inputTableData[rowIndex].inputTypeStr])
            }
          },
          {
            size: { basis: 350, grow: 0 },
            headerRenderer: () => h(HeaderCell, ['Input sources']),
            cellRenderer: ({ rowIndex }) => {
              return InputSourceSelect({
                inputDefinitionIndex: inputTableData[rowIndex].configurationIndex,
                source: _.get('source', inputTableData[rowIndex]),
                inputType: _.get('input_type', inputTableData[rowIndex]),
                update: updateInputSource(`[${inputTableData[rowIndex].configurationIndex}].source`)
              })
            }
          },
          {
            headerRenderer: () => h(HeaderCell, ['Attribute']),
            cellRenderer: ({ rowIndex }) => {
              const source = _.get(`${rowIndex}.source`, inputTableData)
              return Utils.switchCase(source.type || 'none',
                ['record_lookup', () => recordLookupWithWarnings(rowIndex)],
                ['literal', () => parameterValueSelect(rowIndex)],
                ['object_builder', () => structBuilderLink(rowIndex)],
                ['none', () => h(TextCell, { style: { fontStyle: 'italic' } }, ['Optional'])]
              )
            }
          }
        ]
      })
    ])
  }])
}

export default InputsTable
