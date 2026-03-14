const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude the Python server directory from Metro's file watcher
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /server\/.*/,
];

module.exports = config;
