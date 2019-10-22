const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const loadStops = require('../utils/load-stops')
const { createStopsLookup } = require('../utils/datamart-utils')
const stopsData = utils.parseGTFSData(fs.readFileSync('gtfs/4/stops.txt').toString())
const datamartStops = require('../../spatial-datamart/metro-bus-stops.json').features

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')

  let stopsLookup = createStopsLookup(datamartStops)
  let stopCount = await loadStops(stopsData, stops, 'metro bus', stopsLookup, stopName => {
    if (stopName === 'Monash University') return 'Monash University Bus Loop'
    if (stopName.includes('Chadstone SC- ')) return 'Chadstone SC/Eastern Access Rd'
    return stopName
  })

  await updateStats('mbus-stops', stopCount, new Date() - start)
  console.log('Completed loading in ' + stopCount + ' metro bus stops')
  process.exit()
});
