
import https from 'https'
import { DataCollector } from './lib/DataCollector'
import config from '../lib/config'

const collectionName = config.collectionsNames.Prices

export class Prices extends DataCollector {
  constructor (db) {
    super(db, { collectionName })
    this.tickDelay = 5000
    this.state = {}
  }

  start () {
    super.start()
    this.updateState()
  }

  tick () {
    this.updateState()
  }

  getLastPrices () {
    return this.collection.findOne({}, { sort: { _id: -1 } })
      .then(res => {
        res = res.data[0]
        if (res) delete (res._id)
        return res
      })
  }

  async updateState () {
    try {
      let prices = await this.updatePrices()
      prices = prices || {}
      let state = this.state
      let changed = Object.keys(prices).find(k => prices[k] !== state[k])
      if (changed) {
        let prevState = Object.assign({}, this.state)
        delete prevState.prevState
        prices.prevState = prevState
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
