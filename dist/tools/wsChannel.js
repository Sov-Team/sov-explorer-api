"use strict";var _socket = _interopRequireDefault(require("socket.io-client"));
var c = _interopRequireWildcard(require("../lib/cli"));function _getRequireWildcardCache() {if (typeof WeakMap !== "function") return null;var cache = new WeakMap();_getRequireWildcardCache = function () {return cache;};return cache;}function _interopRequireWildcard(obj) {if (obj && obj.__esModule) {return obj;}if (obj === null || typeof obj !== "object" && typeof obj !== "function") {return { default: obj };}var cache = _getRequireWildcardCache();if (cache && cache.has(obj)) {return cache.get(obj);}var newObj = {};var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;for (var key in obj) {if (Object.prototype.hasOwnProperty.call(obj, key)) {var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;if (desc && (desc.get || desc.set)) {Object.defineProperty(newObj, key, desc);} else {newObj[key] = obj[key];}}}newObj.default = obj;if (cache) {cache.set(obj, newObj);}return newObj;}function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}

const url = process.argv[2];
let channel = process.argv[3];

if (!url || !channel) help();

const socket = _socket.default.connect(url, { reconnect: true });

c.info(`Waiting for WS on ${url}`);

socket.on('connect', data => {
  c.ok('Connected! ✌');
  c.info(`subscribing to channel: ${channel}`);
  socket.emit('subscribe', { to: channel });
});

socket.on('subscription', data => {
  if (channel === data.channel) {
    c.info(`subscribed to channel: ${channel}`);
  }
});

socket.on('disconnect', socket => {
  c.warn('Disconnected ☹');
});

socket.on('data', async res => {
  try {
    console.log(res);
  } catch (err) {
    c.error(err);
    process.exit(9);
  }
});

socket.on('Error', err => {
  let error = err.error || '';
  c.error(`ERROR: ${error}`);
  c.warn(err);
});

process.on('unhandledRejection', err => {
  console.error(err);
  process.exit(9);
});

function help() {
  c.info(`Usage: ${process.argv[0]} ${process.argv[1]} [url] [channel]`);
  process.exit(0);
}