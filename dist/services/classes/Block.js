'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.deleteBlockDataFromDb = exports.getBlockFromDb = exports.Block = undefined;var _BcThing = require('./BcThing');
var _Address = require('./Address');var _Address2 = _interopRequireDefault(_Address);
var _txFormat = require('../../lib/txFormat');var _txFormat2 = _interopRequireDefault(_txFormat);
var _Contract = require('./Contract');var _Contract2 = _interopRequireDefault(_Contract);
var _ContractParser = require('../../lib/ContractParser');var _ContractParser2 = _interopRequireDefault(_ContractParser);
var _utils = require('../../lib/utils');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}
class Block extends _BcThing.BcThing {
  constructor(hashOrNumber, options) {
    super(options.web3, options.collections);
    this.Blocks = this.collections.Blocks;
    this.fetched = false;
    this.log = options.Logger || console;
    this.hashOrNumber = hashOrNumber;
    this.addresses = {};
    this.contracts = {};
    this.tokenAddresses = {};
    this.contractParser = new _ContractParser2.default(this.web3);
    this.data = {
      block: null,
      txs: [],
      addresses: [],
      contracts: [],
      tokenAddresses: [],
      events: [] };

  }
  async fetch(forceFetch) {
    if (this.fetched && !forceFetch) {
      return Promise.resolve(this.getData());
    }
    if (!this.web3.isConnected()) {
      return Promise.reject(new Error('web3 is not connected'));
    }
    try {
      let blockData = await this.getBlock(this.hashOrNumber);
      this.data.block = blockData;
      this.addAddress(blockData.miner);
      this.data.txs = await Promise.all(blockData.transactions.
      map((txHash, index) => this.getTx(txHash, index)));
      this.data.contracts = await this.fetchItems(this.contracts);
      this.data.events = await Promise.all(this.data.txs.
      map(tx => this.parseTxEvents(tx))).
      then(
      events => [].concat.apply([], events));

      this.addEventsAddresses();
      this.mergeContractsAddresses();
      this.data.addresses = await this.fetchItems(this.addresses);
      this.data.tokenAddresses = await this.fetchContractsAddresses();
      this.fetched = true;
      return this.getData();
    } catch (err) {
      this.log.error(err);
    }
  }

  getBlock(number, txArr = false) {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlock(number, txArr, (err, blockData) => {
        if (err !== null) return reject(err);
        if (blockData) {
          blockData._received = Date.now();
          resolve(blockData);
        } else {
          return reject(new Error(`BlockData of block ${number} is empty`));
        }
      });
    });
  }

  async getTx(txHash, index, tx) {
    // if (!tx) tx = await this.getTransactionByHash(txHash)
    if (!tx) tx = await this.getTransactionByIndex(index);
    let receipt = await this.getTxReceipt(txHash);
    tx.receipt = receipt;
    if (!tx.transactionIndex) tx.transactionIndex = receipt.transactionIndex;
    this.addAddress(receipt.contractAddress);
    tx.timestamp = this.data.block.timestamp;
    this.addContract(tx);
    this.addAddress(tx.to);
    this.addAddress(tx.from);
    tx = (0, _txFormat2.default)(tx);
    return tx;
  }

  getTransactionByHash(txHash) {
    return new Promise((resolve, reject) => {
      // eth.getTransaction returns null in rskj/BAMBOO-f02dca7
      this.web3.eth.getTransaction(txHash, (err, tx) => {
        if (err !== null) return reject(err);else
        {
          if (!tx) return reject(new Error(`The Tx: ${txHash}, returns null value`));else
          resolve(tx);
        }
      });
    });
  }
  getTransactionByIndex(index) {
    return new Promise((resolve, reject) => {
      this.web3.eth.getTransactionFromBlock(this.hashOrNumber, index, (err, tx) => {
        if (err !== null) return reject(err);else
        {
          if (!tx) return reject(new Error(`The Tx: ${this.hashOrNumber}/${index}, returns null value`));else
          resolve(tx);
        }
      });
    });
  }
  getTxReceipt(txHash) {
    return new Promise((resolve, reject) => {
      this.web3.eth.getTransactionReceipt(txHash, (err, receipt) => {
        if (err !== null) return reject(err);
        resolve(receipt);
      });
    });
  }

  parseTxLogs(logs) {
    let parser = this.contractParser;
    return new Promise((resolve, reject) => {
      process.nextTick(() => resolve(parser.parseTxLogs(logs)));
    });
  }

  parseTxEvents(tx) {
    const timestamp = tx.timestamp;
    return this.parseTxLogs(tx.receipt.logs).
    then(topics => topics.filter(t => t.event).
    map(event => {
      let id = `${event.blockNumber}-${event.transactionIndex}-${event.logIndex}`;
      event._id = id;
      event.timestamp = timestamp;
      return event;
    }));

  }

  async save() {
    let db = this.collections;
    try {
      let data = await this.fetch();
      if (!data) throw new Error(`Fetch returns empty data for block #${this.hashOrNumber}`);
      data = this.serialize(data);
      let block, txs, events, tokenAddresses;
      ({ block, txs, events, tokenAddresses } = data);
      let result = {};
      result.block = await this.saveOrReplaceBlock(block);
      if (!result.block) {
        this.log.debug(`Block ${block.number} - ${block.hash} was not saved`);
        return { result, data };
      }

      await Promise.all([...txs.map(tx => db.Txs.insertOne(tx))]).
      then(res => {result.txs = res;});

      await Promise.all(
      Object.values(this.addresses).map(a => a.save())).
      then(res => {result.addresses = res;});

      await Promise.all(
      events.map(e => db.Events.insertOne(e))).
      then(res => {result.events = res;});

      await Promise.all(
      tokenAddresses.map(ta => db.TokensAddrs.updateOne(
      { address: ta.address, contract: ta.contract }, { $set: ta }, { upsert: true }))).
      then(res => {result.tokenAddresses = res;});
      return { result, data };
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async saveOrReplaceBlock(block) {
    try {
      if (!block || !block.hash) throw new Error('Block data is empty');
      let res;
      let exists = await this.searchBlock(block);
      if (exists.length > 1) {
        throw new Error(`ERROR block ${block.number}-${block.hash} has ${exists.length} duplicates`);
      }
      if (exists.length) {
        let oldBlock = exists[0];
        if (oldBlock.hash === block.hash) throw new Error(`Block ${block.hash} exists in db`);
        let bestBlock = (0, _utils.getBestBlock)([...exists, block]);
        if (bestBlock.hash !== block.hash) {
          throw new Error(`The stored block ${bestBlock.hash} is better than ${block.hash}`);
        }
        let oldBlockData = await this.getBlockFromDb(oldBlock.hash, true);
        res = await this.replaceBlock(block, oldBlockData);
      } else {
        res = await this.insertBlock(block);
      }
      return res;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  searchBlock(block) {
    let hash = block.hash;
    let number = block.number;
    return this.collections.Blocks.find({ $or: [{ hash }, { number }] }).toArray();
  }

  insertBlock(block) {
    return this.collections.Blocks.insertOne(block);
  }

  async getBlockFromDb(hashOrNumber, allData) {
    let block = await getBlockFromDb(hashOrNumber, this.collections.Blocks);
    if (allData) {
      if (!block) return;
      block = { block };
      let blockHash = block.hash;
      await Promise.all([
      this.getBlockTransactionsFromDb(blockHash).then(txs => {block.txs = txs;}),
      this.getBlockEventsFromDb(blockHash).then(events => {block.events = events;})]);

    }
    return block;
  }

  getBlockEventsFromDb(blockHash) {
    return this.collections.Events.find({ blockHash }).toArray();
  }

  getBlockTransactionsFromDb(blockHash) {
    return this.collections.Txs.find({ blockHash }).toArray();
  }

  async replaceBlock(newBlock, oldBlock) {
    try {
      let block, txs, events;
      ({ block, txs, events } = oldBlock);
      block._replacedBy = newBlock.hash;
      block._events = events;
      block.transactions = txs;
      await this.saveOrphanBlock(block);
      await this.deleteBlockDataFromDb(block.hash, block.number);
      newBlock._replacedBlockHash = block.hash;
      let res = await this.insertBlock(newBlock);
      return res;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  deleteBlockDataFromDb(blockHash, blockNumber) {
    return deleteBlockDataFromDb(blockHash, blockNumber, this.collections);
  }

  saveOrphanBlock(blockData) {
    delete blockData._id;
    blockData._updated = Date.now();
    return this.collections.OrphanBlocks.updateOne({ hash: blockData.hash }, { $set: blockData }, { upsert: true });
  }

  addAddress(address, type) {
    if (!this.isAddress(address)) return;
    const Addr = new _Address2.default(address, this.web3, this.collections.Addrs);
    this.addresses[address] = Addr;
  }

  addContract(tx) {
    let address = tx.receipt.contractAddress;
    if (address) {
      let data = { tx, code: () => this.getAddressCode(address) };
      return this.getContract(address, data);
    }
  }

  getContract(address, data) {
    let contract = this.contracts[address];
    if (contract) return contract;else
    return this.newContract(address, data);
  }

  newContract(address, data) {
    let contract = new _Contract2.default(address, data, this.web3, this.contractParser);
    this.contracts[address] = contract;
    return contract;
  }

  getAddressCode(address) {
    return this.addresses[address].code;
  }

  addEventsAddresses() {
    this.data.events.forEach(event => {
      if (event && event.args) {
        let address = event.address;
        let fromAddress = event.args._from;
        let toAddress = event.args._to;
        this.addAddress(fromAddress);
        this.addAddress(toAddress);
        let contract = this.getContract(address);
        contract.addAddress(fromAddress);
        contract.addAddress(toAddress);
        // get token balances of accounts
      }
    });
  }

  // adds contract data to addresses
  mergeContractsAddresses() {
    let contracts = this.data.contracts;
    contracts.forEach(contract => {
      let address = contract.address;
      let Addr = this.addresses[address];
      if (Addr) {
        for (let prop in contract) {
          if (prop !== 'addresses') Addr.setData(prop, contract[prop]);
        }
      }
    });
  }
  async fetchContractsAddresses() {
    let data = [];
    for (let c in this.contracts) {
      let contract = this.contracts[c];
      let addData = await contract.fetchAddresses();
      if (addData.length) data = data.concat(addData);
    }
    return data;
  }
  fetchItems(items) {
    return Promise.all(Object.values(items).map(i => i.fetch()));
  }}exports.Block = Block;


const getBlockFromDb = exports.getBlockFromDb = async (blockHashOrNumber, collection) => {
  let query = (0, _utils.blockQuery)(blockHashOrNumber);
  if (query) return collection.findOne(query);
  return Promise.reject(new Error(`"${blockHashOrNumber}": is not block hash or number`));
};

const deleteBlockDataFromDb = exports.deleteBlockDataFromDb = async (blockHash, blockNumber, db) => {
  try {
    if (!blockHash) throw new Error('Invalid block hash');
    let hash = blockHash;
    let result = {};
    let query = { $or: [{ blockHash }, { blockNumber }] };
    result.block = await db.Blocks.deleteOne({ hash });
    result.txs = await db.Txs.deleteMany(query);
    result.events = await db.Events.deleteMany(query);
    return result;
  } catch (err) {
    return Promise.reject(err);
  }
};exports.default =

Block;