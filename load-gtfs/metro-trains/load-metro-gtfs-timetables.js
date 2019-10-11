const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const fs = require('fs')
const async = require('async')
const EventEmitter = require('events');

const calendar = utils.parseGTFSData(fs.readFileSync('gtfs/2/calendar.txt').toString())
const calendarDates = utils.parseGTFSData(fs.readFileSync('gtfs/2/calendar_dates.txt').toString())
const trips = utils.parseGTFSData(fs.readFileSync('gtfs/2/trips.txt').toString())
const tripTimesData = utils.parseGTFSData(fs.readFileSync('gtfs/2/stop_times.txt').toString())

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null
let routes = null
let gtfsTimetables = null

let calendarDatesCache = {}

let stationLoaders = {}
let stationCache = {}
let routeLoaders = {}
let routeCache = {}

async function getStation(stopGTFSID) {
  if (stationLoaders[stopGTFSID]) {
    return await new Promise(resolve => stationLoaders[stopGTFSID].on('loaded', resolve))
  } else if (!stationCache[stopGTFSID]) {
    stationLoaders[stopGTFSID] = new EventEmitter()
    stationLoaders[stopGTFSID].setMaxListeners(20000)

    let station = await stops.findDocument({
      'bays.stopGTFSID': stopGTFSID
    })

    let metroStation = station.bays.filter(bay => bay.mode === 'metro train')[0]

    stationCache[stopGTFSID] = metroStation
    stationLoaders[stopGTFSID].emit('loaded', metroStation)
    delete stationLoaders[stopGTFSID]

    return metroStation
  } else return stationCache[stopGTFSID]
}

async function getRoute(routeGTFSID) {
  if (routeLoaders[routeGTFSID]) {
    return await new Promise(resolve => routeLoaders[routeGTFSID].on('loaded', resolve))
  } else if (!routeCache[routeGTFSID]) {
    routeLoaders[routeGTFSID] = new EventEmitter()
    routeLoaders[routeGTFSID].setMaxListeners(5000)

    let route = await routes.findDocument({ routeGTFSID })

    routeCache[routeGTFSID] = route
    routeLoaders[routeGTFSID].emit('loaded', route)
    delete routeLoaders[routeGTFSID]

    return route
  } else return routeCache[routeGTFSID]
}

async function loadBatchIntoDB(trips, db) {
  let allTrips = {}

  await async.forEach(trips, async trip => {
    let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(trip[0]),
        serviceID = trip[1],
        tripID = trip[2],
        shapeID = trip[3],
        direction = trip[4].includes('Flinders Street') || (routeGTFSID === '2-SPT' && trip[4] === 'Frankston'),
        gtfsDirection = trip[5]

    direction = direction ? 'Up' : 'Down'

    let route = await getRoute(routeGTFSID)
    if (!calendarDatesCache[serviceID])
      calendarDatesCache[serviceID] = gtfsUtils.calendarToDates(calendar, calendarDates, serviceID)

    allTrips[tripID] = {
      mode: "metro train",
      operator: "Metro Trains Melbourne",
      routeName: route.routeName,
      tripID,
      routeGTFSID,
      operationDays: calendarDatesCache[serviceID].map(date => date.format('YYYYMMDD')),
      stopTimings: [],
      destination: null,
      departureTime: null,
      origin: null,
      direction,
      gtfsDirection,
      shapeID
    }
  })

  await async.forEach(tripTimesData, async (stopTiming, i) => {
    let tripID = stopTiming[0],
        arrivalTime = stopTiming[1].slice(0, 5),
        departureTime = stopTiming[2].slice(0, 5),
        stopGTFSID = parseInt(stopTiming[3]),
        stopSequence = parseInt(stopTiming[4]),
        pickupFlags = stopTiming[6],
        dropoffFlags = stopTiming[7],
        stopDistance = parseInt(stopTiming[8])

    let station = await getStation(stopGTFSID)

    if (!allTrips[tripID]) return

    allTrips[tripID].stopTimings[stopSequence - 1] = {
      stopName: station.fullStopName,
      stopGTFSID,
      arrivalTime,
      arrivalTimeMinutes: utils.time24ToMinAftMidnight(arrivalTime),
      departureTime,
      departureTimeMinutes: utils.time24ToMinAftMidnight(departureTime),
      stopConditions: "",
      stopDistance: stopDistance,
      stopSequence
    }
  })

  let bulkOperations = []

  Object.keys(allTrips).forEach(tripID => {
    allTrips[tripID].stopTimings = allTrips[tripID].stopTimings.filter(Boolean)
    let stopTimings = allTrips[tripID].stopTimings

    stopTimings = stopTimings.filter(Boolean)
    let stopCount = stopTimings.length

    allTrips[tripID].destination = stopTimings[stopCount - 1].stopName
    allTrips[tripID].departureTime = stopTimings[0].departureTime
    allTrips[tripID].origin = stopTimings[0].stopName

    stopTimings[0].arrivalTime = null
    stopTimings[0].arrivalTimeMinutes = null

    stopTimings[stopCount - 1].departureTime = null
    stopTimings[stopCount - 1].departureTimeMinutes = null

    allTrips[tripID].tripStartHour = Math.floor(stopTimings[0].departureTimeMinutes / 60)
    allTrips[tripID].tripEndHour = Math.floor(stopTimings[stopCount - 1].arrivalTimeMinutes / 60)

    bulkOperations.push({
      insertOne: {
        document: allTrips[tripID]
      }
    })
  })

  await gtfsTimetables.bulkWrite(bulkOperations, {
    ordered: false
  })
  return Object.keys(allTrips).length
}

database.connect({
  poolSize: 500
}, async err => {
  stops = database.getCollection('stops')
  routes = database.getCollection('routes')
  gtfsTimetables = database.getCollection('gtfs timetables')

  await gtfsTimetables.createIndex({
    mode: 1,
    routeName: 1,
    operationDays: 1,
    destination: 1,
    tripStartHour: 1,
    tripEndHour: 1,
    tripID: 1,
    shapeID: 1
  }, {unique: true, name: "gtfs timetable index"})

  await gtfsTimetables.deleteDocuments({mode: "metro train"})

  let loaded = 0
  let start = 0

  async function loadBatch() {
    let tripsToLoad = trips.slice(start, start + 5000)
    if (!tripsToLoad.length) return
    loaded += await loadBatchIntoDB(tripsToLoad, database)

    start += 5000
    await loadBatch()
  }

  await loadBatch()

  // loaded = await loadBatchIntoDB(trips, database)

    await gtfsTimetables.createIndex({
      mode: 1,
      routeName: 1,
      operationDays: 1,
      destination: 1,
      tripStartHour: 1,
      tripEndHour: 1,
      tripID: 1,
      shapeID: 1
    }, {unique: true, name: "gtfs timetable index"})

  console.log('Completed loading in ' + loaded + ' MTM trips')
  process.exit()
})
