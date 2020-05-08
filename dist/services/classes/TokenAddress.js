"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = exports.TokenAddress = void 0;var _BcThing = require("./BcThing");
var _Contract = _interopRequireDefault(require("./Contract"));
var _utils = require("../../lib/utils");function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

class TokenAddress extends _BcThing.BcThing {
  constructor(address, contract) {
    if (!(contract instanceof _Contract.default)) {
      throw new Error('contract is not instance of Contract');
    }
    let { block } = contract;
    if (!(0, _utils.isBlockObject)(block)) {
      throw new Error(`Block must be a block object`);
    }
    const { initConfig } = contract;
    super({ initConfig });
    if (!this.isAddress(address)) {
      throw new Error(`TokenAddress: invalid address: ${address}`);
    }
    this.Contract = contract;
    this.address = address;
    let { number, hash } = block;
    this.data = {
      address,
      contract: this.Contract.address,
      balance: null,
      block: { number, hash } };

  }
  async fetch() {
    try {
      let balance = await this.getBalance();
      this.data.balance = balance;
      return this.getData();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  getBalance() {
    return this.Contract.call('balanceOf', [this.address]);
  }}exports.TokenAddress = TokenAddress;var _default =


TokenAddress;exports.default = _default;