import _ from 'lodash/fp'
import { useEffect, useMemo, useState } from 'react'
import { div, h, input, label, span } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { Link, Select } from 'src/components/common'
import { icon } from 'src/components/icons'
import { makeCromwellStatusLine } from 'src/components/job-common'
import { FlexTable, Sortable, tableHeight, TooltipCell } from 'src/components/table'
import colors from 'src/libs/colors'
import * as Utils from 'src/libs/utils'
import { FailuresModal } from 'src/pages/workspaces/workspace/jobHistory/FailuresViewer'


///////////////FILTER UTILITY FUNCTIONS/////////////////////////////
export const taskNameFilter = searchText => {
  const searchTerms = searchText.toLowerCase().split(/[\s_/]/)
  return _.filter(callObject => {
    return searchTerms.every(term => (callObject?.taskName || '').toLowerCase().includes(term))
  })
}

export const statusFilter = statuses => {
  return _.filter(({ statusObj }) => {
    const { id } = statusObj
    return _.isEmpty(statuses) ? true : statuses.includes(_.startCase(id))
  })
}

export const filterCalllObjectsFn = (callObjects, sort, setFilteredCallObjects, statuses) => {
  return (searchText = '') => {
    const results = _.flow(
      taskNameFilter(searchText),
      statusFilter(statuses),
      _.sortBy(sort.field),
      sort.direction === 'asc' ? _.identity : _.reverse)(callObjects)
    setFilteredCallObjects(results)
  }
}

//////////////STATUS COUNT SUB-COMPONENT///////////////////////////
const StatusCounts = ({statusListObjects}) => {
  const statuses = Object.keys(statusListObjects)
  const statusCountRender = statuses.map(status => {
    const { count, icon } = statusListObjects[status]
    return span({ key: `${status}-status-count`, style: { marginRight: '20px' } }, [
      icon(),
      span({ style: { fontWeight: 800, marginLeft: '3px' } }, [`${count} `]),
      span(`${status}`)
    ])
  })
  return div({}, [statusCountRender])
}

//////////////TABLE SEARCH BAR///////////////////////
const SearchBar = ({ filterFn }) => {
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    filterFn(searchText)
  }, [filterFn, searchText])

  return div(
    {
      id: 'task-name-search',
      style: {
        flexBasis: '400px'
      }
    },
    [
      input({
        id: 'task-name-search-input',
        type: 'text',
        placeholder: 'Search by task name',
        style: { width: '100%', padding: '9px', borderRadius: '15px', border: '1px solid #8F95A0' },
        value: searchText,
        onChange: e => setSearchText(e.target.value)
      })
    ]
  )
}


////////CALL TABLE///////////////////////
const CallTable = ({ callName, callObjects }) => {
  const [failuresModalParams, setFailuresModalParams] = useState()
  const [sort, setSort] = useState({ field: 'index', direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState([])
  const [filteredCallObjects, setFilteredCallObjects] = useState([])

  const filterFn = useMemo(() => {
    return filterCalllObjectsFn(callObjects, sort, setFilteredCallObjects, statusFilter)
  }, [callObjects, sort, setFilteredCallObjects, statusFilter])

  const statusListObjects = useMemo(() => {
    const statusSet = {}
    callObjects.forEach(({ statusObj }) => {
      if (!_.isEmpty(statusObj)) {
        const { icon, id } = statusObj
        const startCasedId = _.startCase(id)
        if (!statusSet[startCasedId]) {
          statusSet[startCasedId] = { count: 0 }
        }
        statusSet[startCasedId].count += 1
        statusSet[startCasedId].icon = icon
      } else {
        return {}
      }
    })
    return statusSet
  }, [callObjects])

  return div([
    label({
      style: {
        fontWeight: 700
      }
    }, ['Filter by:']),
    div({ style: { margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
      div({
        id: 'filter-section-left',
        style: {
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          flexBasis: 400,
          flexGrow: 2
        }
      }, [
        div({ style: { flexBasis: 250, marginRight: '20px' } }, [
          h(Select, {
            isClearable: true,
            isMulti: true,
            isSearchable: false,
            placeholder: 'Status',
            'aria-label': 'Status',
            value: statusFilter,
            onChange: data => setStatusFilter(_.map('value', data)),
            options: Object.keys(statusListObjects)
          })
        ]),
        h(StatusCounts, { statusListObjects })
      ]),
      div({
        id: 'filter-section-right', style: {
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexBasis: 400,
          flexGrow: 1
        }}, [
        h(SearchBar, { filterFn })
      ])
    ]),

    /*
      How to deal with visible rows?
      Initial view shows only the latest attempt with a "Show all attempts" button that expands the table to show all attempts on click
      This can be compromised if the user is allowed to sort by attempts in ascending order since it'll put the latest attempt at the bottom
      Gut feeling is to assume that users shoudn't be able to sort the table in a way that overrides (name, attempt) ordering
      NOTE: React-Virtualized has a multisort option, need to utilize that to sort by column plus attempt in desc order
    */
    h(AutoSizer, { disableHeight: true }, [
      ({ width }) =>
        h(FlexTable, {
          'aria-label': 'call table',
          height: tableHeight({ actualRows: filteredCallObjects.length, maxRows: 10.5 }), // The half-row here hints at there being extra rows if scrolled
          width,
          sort,
          rowCount: filteredCallObjects.length,
          noContentMessage: 'No matching calls',
          columns: [
            {
              size: { basis: 300, grow: 2 },
              field: 'taskName',
              headerRenderer: () => h(Sortable, { sort, field: 'taskName', onSort: setSort }, ['Name']),
              cellRenderer: ({ rowIndex }) => {
                const { taskName } = filteredCallObjects[rowIndex]
                return taskName
              }
            },
            {
              size: { basis: 100, grow: 1 },
              field: 'type',
              headerRenderer: () => h(Sortable, { sort, field: 'type', onSort: setSort }, ['Type']),
              cellRenderer: ({ rowIndex }) => {
                const { subWorkflowId } = filteredCallObjects[rowIndex]
                return _.isEmpty(subWorkflowId) ? 'Task' : 'Sub-workflow'
              }
            },
            {
              size: { basis: 100, grow: 1 },
              field: 'attempt',
              headerRenderer: () => h(Sortable, { sort, field: 'attempt', onSort: setSort }, ['Attempt']),
              cellRenderer: ({ rowIndex }) => {
                const { attempt } = filteredCallObjects[rowIndex]
                return attempt
              }
            },
            {
              size: { basis: 150, grow: 2 },
              field: 'status',
              headerRenderer: () => h(Sortable, { sort, field: 'status', onSort: setSort }, ['Status']),
              cellRenderer: ({ rowIndex }) => {
                const { executionStatus, backendStatus } = filteredCallObjects[rowIndex]
                return makeCromwellStatusLine(executionStatus, backendStatus)
              },
            },
            {
              size: { basis: 200, grow: 1 },
              field: 'start',
              headerRenderer: () => h(Sortable, { sort, field: 'start', onSort: setSort }, ['Start']),
              cellRenderer: ({ rowIndex }) => {
                const { start } = filteredCallObjects[rowIndex];
                return h(TooltipCell, [start ? Utils.makeCompleteDate(start) : 'N/A'])
              }
            },
            {
              size: { basis: 200, grow: 1 },
              field: 'end',
              headerRenderer: () => h(Sortable, { sort, field: 'end', onSort: setSort }, ['End']),
              cellRenderer: ({ rowIndex }) => {
                const { end } = filteredCallObjects[rowIndex];
                return h(TooltipCell, [end ? Utils.makeCompleteDate(end) : 'N/A'])
              }
            }
            //NOTE: This final section will be held for the action modals
            //Tempted to leave this off as a seperate ticket (where the modals are developed and implemented in the page independently)
            // {
            //   size: { basis: 200, grow: 2 },
            //   headerRenderer: () => 'Links',
            //   cellRenderer: ({ rowIndex }) => {
            //     const { failures, shardIndex: index, attempt } = filteredCallObjects[rowIndex]
            //     const failureCount = _.size(failures)
            //     return !!failureCount && h(Link, {
            //       style: { marginLeft: '0.5rem' },
            //       onClick: () => setFailuresModalParams({ index, attempt, failures })
            //     }, [
            //       div({ style: { display: 'flex', alignItems: 'center' } }, [
            //         icon('warning-standard', { size: 18, style: { color: colors.warning(), marginRight: '0.5rem' } }),
            //         `${failureCount} Message${failureCount > 1 ? 's' : ''}`
            //       ])
            //     ])
            //   }
            // }
          ]
        })
    ]),
    failuresModalParams && h(FailuresModal, { ...failuresModalParams, callFqn: callName, onDismiss: () => setFailuresModalParams(undefined) }),
  ])
}

export default CallTable
