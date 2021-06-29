
import https from 'https'
import { DataCollector } from './lib/DataCollector'
import config from '../lib/config'

const collectionName = config.collectionsNames.Prices

const priceList = [
  {from: 'bitcoin', to: 'usd', pairs: ['rbtc/usd', 'wrbtc/usd']},
  {from: 'ethereum', to: 'usd', pairs: ['eths/usd']},
  {from: 'rif-token', to: 'usd', pairs: ['rif/usd']},
  {from: 'binancecoin', to: 'usd', pairs: ['bnbs/usd']},
  {from: 'sovryn', to: 'usd', pairs: ['sov/usd']},
  // use usdt value for DoC and xusd as they are not listed on coingecko
  {from: 'tether', to: 'usd', pairs: ['rusdt/usd', 'xusd/usd', 'doc/usd']}
]

export class Prices extends DataCollector {
  constructor (db) {
    super(db, { collectionName })
    this.tickDelay = 30000
    this.state = {
    }
  }

  start () {
    super.start()
    this.getLastPrices().then(prices => this.updateState(prices))
  }

  tick () {
    this.updatePrices().then(prices => this.updateState(prices)).then((newState) => {
      if (newState) {
        this.events.emit('newPrices', this.formatData(newState))
      }
    })
  }

  getState () {
    return this.formatData(this.state)
  }

  async getLastPrices () {
    const prices = {}
    const pairs = priceList.reduce((acc, value) => {
      acc.push(...value.pairs)
      return acc
    }, [])
    const lastPrices = await Promise.all(pairs.map(pair => this.collection.findOne({ pair }, { sort: { _id: -1 } })))
    lastPrices.forEach((price) => {
      if (price) prices[price.pair] = price.value
    })
    return prices
  }

  async updateState (prices) {
    try {
      prices = prices || {}
      let state = this.state
      let changed = Object.keys(prices).find(k => prices[k] !== state[k])
      if (changed) {
        this.state = prices
        return prices
      }
    } catch (err) {
      this.log.warn(err)
    }
  }

  async _callPriceApi (fromCurrency, toCurrency) {
    return new Promise((resolve, reject) => {
      const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${fromCurrency}&vs_currencies=${toCurrency}`
      https.get(apiUrl, (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      }).on('error', (error) => reject(error))
    })
  }

  async updatePrices () {
    const prices = {}
    for (let pricePair of priceList) {
      try {
        const price = await this._callPriceApi(pricePair.from, pricePair.to)
        await Promise.all(pricePair.pairs.map(pair => {
          const priceData = {
            pair,
            value: price[pricePair.from][pricePair.to],
            date: new Date()
          }
          prices[pair] = priceData.value
          return this.collection.updateOne({ pair: priceData.pair }, { $set: priceData }, { upsert: true })
        }))
      } catch (err) {
        return Promise.reject(err)
      }
    }
    return prices
  }
}

export default Prices
