import Web3 from 'web3'
const web3 = new Web3()

export const filterParams = (params, perPageMax = 50) => {
  params = params || {}
  let perPage = params.perPage || perPageMax
  perPage = (perPage <= perPageMax) ? perPage : perPageMax
  params.page = params.page || 1
  let limit = params.limit || perPage
  limit = limit <= perPage ? limit : perPage
  params.limit = limit
  params.query = filterQuery(params.query)
  params.sort = filterSort(params.sort)
  return params
}

export const filterQuery = (query) => {
  if (!query) return
  if (typeof (query) === 'object') {
    if (Object.keys(query).length > 0) {
      return sanitizeQuery(query)
    }
  }
}

export const filterSort = (sort) => {
  if (!sort) return
  let filtered = null
  if (sort && typeof (sort) === 'object') {
    let keys = Object.keys(sort)
    filtered = {}
    for (let k of keys) {
      let val = sort[k]
      filtered[k] = (!val || val === 1) ? 1 : -1
    }
  }
  return retFiltered(filtered)
}

const sanitizeQuery = (query) => {
  let filtered = {}
  for (let p in query) {
    let k = p.replace('$', '')
    if (k === p) filtered[k] = query[p]
  }
  return retFiltered(filtered)
}

const retFiltered = (filtered) => {
  return (filtered && Object.keys(filtered).length > 0) ? filtered : null
}

export const isAddress = (address) => {
  return web3.isAddress(address)
}
