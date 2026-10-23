const config = require('flarum-webpack-config')();

// 使用具名 ID：webpack 默认的数字 ID 会与其他扩展在全局
// `webpackChunkmodule_exports` 中冲突，后加载的异步 chunk 会报
// "s[t] is not a function"。
config.optimization = config.optimization || {};
config.optimization.moduleIds = 'named';
config.optimization.chunkIds = 'named';

module.exports = config;
