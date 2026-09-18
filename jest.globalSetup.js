// Run every test in a zone ahead of UTC with daylight saving, so date bugs that only
// show up outside UTC (e.g. toISOString-based day keys) fail here rather than in the app.
module.exports = () => {
  process.env.TZ = "Asia/Nicosia";
};
