
import { add0x } from 'rsk-utils'
import ContractParser from 'rsk-contract-parser'

export async function updateTokenAccountBalances (block, { nod3, collections, log }) {
  const parser = new ContractParser({ nod3 })
  let { number } = block
  number = parseInt(number) - 1
  if (number < 1) return
  log.trace(`Checking token account balances for block ${number}`)
  try {
    let collection = collections.TokensAddrs
    let query = { 'block.number': number }
    let cursor = collection.find(query)
    await cursor.forEach(async account => {
      try {
        let { balance, _id, address, contract } = account
        let newBalance = await getBalance(account, { parser })
        if (balance !== newBalance) {
          log.info(`Updating token account balance ${contract}--${address}`)
          await collection.updateOne({ _id }, { $set: { balance: newBalance } })
        }
      } catch (err) {
        log.error(err)
        return Promise.reject(err)
      }
    })

  } catch (err) {
    return Promise.reject(err)
  }
}

async function getBalance ({ address, contract }, { parser, abi } = {}) {
  try {
    let Contract = parser.makeContract(contract, abi)
    let balance = await Contract.call('balanceOf', [address])
    if (balance) balance = add0x(balance.toString(16))
    return balance
  } catch (err) {
    return Promise.reject(err)
  }
}