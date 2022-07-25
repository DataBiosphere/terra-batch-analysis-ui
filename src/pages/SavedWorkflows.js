import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h, h3 } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { ButtonOutline } from 'src/components/common'
import { FlexTable, Sortable, TextCell } from 'src/components/table'
import * as Utils from 'src/libs/utils'


export const SavedWorkflows = ({ runsData, setWorkflowUrl, setShowInputsPage }) => {
  // State
  const [sort, setSort] = useState({ field: 'submissionTimestamp', direction: 'desc' })

  const sortedPreviousRuns = _.orderBy(sort.field, sort.direction, runsData)

  return div({ style: { marginTop: '2em', display: 'flex', flexDirection: 'column' } }, [
    h3(['Saved Workflows']),
    div({ style: { flex: `1 1 auto`, height: '100%', minHeight: '25em' } }, [
      h(AutoSizer, [
        ({ width, height }) => h(FlexTable, {
          'aria-label': 'saved workflows',
          width, height, sort,
          rowCount: sortedPreviousRuns.length,
          noContentMessage: 'Nothing here yet! Your previously run workflows will be saved here.',
          hoverHighlight: true,
          columns: [
            {
              size: { basis: 500 },
              field: 'workflowUrl',
              headerRenderer: () => h(Sortable, { sort, field: 'workflowUrl', onSort: setSort }, ['Workflow Link']),
              cellRenderer: ({ rowIndex }) => {
                return h(TextCell, [sortedPreviousRuns[rowIndex].workflow_url])
              }
            },
            {
              size: { basis: 250, grow: 0 },
              field: 'submissionTimestamp',
              headerRenderer: () => h(Sortable, { sort, field: 'submissionTimestamp', onSort: setSort }, ['Last Run']),
              cellRenderer: ({ rowIndex }) => {
                console.log(sortedPreviousRuns[rowIndex])
                console.log(sortedPreviousRuns[rowIndex].submission_date)
                console.log('Interpreting submitted date value string: ', sortedPreviousRuns[rowIndex].submission_date)
                return h(TextCell, [Utils.makeCompleteDate(sortedPreviousRuns[rowIndex].submission_date)])
              }
            },
            {
              size: { basis: 190, grow: 0 },
              field: 'useWorkflowButton',
              headerRenderer: () => '',
              cellRenderer: ({ rowIndex }) => {
                return h(ButtonOutline, {
                  onClick: () => {
                    setWorkflowUrl(sortedPreviousRuns[rowIndex].workflowUrl)
                    setShowInputsPage(true)
                  }
                }, ['Use Workflow'])
              }
            }
          ]
        })
      ])
    ])
  ])
}
