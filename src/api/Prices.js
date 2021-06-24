
import https from 'https'
import { DataCollector } from './lib/DataCollector'
import config from '../lib/config'

const collectionName = config.collectionsNames.Prices

export class Prices extends DataCollector {
  constructor (db) {
    super(db, { collectionName })
    this.tickDelay = 5000
    this.state = {
      'rbtc/usd': 0
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
    const btcPrice = await this.collection.findOne({ pair: 'rbtc/usd' }, { sort: { _id: -1 } })
    prices['rbtc/usd'] = btcPrice ? btcPrice.value : 0
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
    try {
      const prices = {}
      const btcPrice = await this._callPriceApi('bitcoin', 'usd')
      const priceData = {
        pair: 'rbtc/usd',
        value: btcPrice.bitcoin.usd,
        date: new Date()
      }
      await this.collection.updateOne({ pair: priceData.pair }, { $set: priceData }, { upsert: true })
      prices[priceData.pair] = priceData.value
      return prices
    } catch (err) {
      return Promise.reject(err)
    }
  }
}

export default Prices
