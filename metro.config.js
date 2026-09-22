// The website in apps/ has its own node_modules; keep Metro from crawling it.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const website = new RegExp(`^${escape(path.resolve(__dirname, "apps"))}[/\\\\].*`);
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), website];

module.exports = config;
