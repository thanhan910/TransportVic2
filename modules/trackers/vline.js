const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getVNETDepartures = require('../vline/get-vnet-departures')
const handleTripShorted = require('../vline/handle-trip-shorted')
const findTrip = require('../vline/find-trip')
const correctARTMBY = require('../vline/correct-art-mby')
const { getDayOfWeek } = require('../../public-holidays')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function getDeparturesFromVNET(db) {
  let vnetDepartures = [
    ...await getVNETDepartures('', 'D', db, 1440), ...await getVNETDepartures('', 'U', db, 1440),
    ...await getVNETDepartures('', 'D', db, 1440, true), ...await getVNETDepartures('', 'U', db, 1440, true)
  ]

  let vlineTrips = db.getCollection('vline trips')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let allTrips = {}

  await async.forEach(vnetDepartures, async departure => {
    let departureDay = utils.getYYYYMMDD(departure.originDepartureTime)
    let departureTimeHHMM = utils.formatHHMM(departure.originDepartureTime)
    let dayOfWeek = await getDayOfWeek(departure.originDepartureTime)

    let departureTimeMinutes = utils.getMinutesPastMidnight(departure.originDepartureTime)
    if (departureTimeMinutes < 180) {
      let previousDay = departure.originDepartureTime.clone().add(-1, 'day')
      departureDay = utils.getYYYYMMDD(previousDay)
      dayOfWeek = await getDayOfWeek(previousDay)
    }

    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let trip = (await liveTimetables.findDocument({
      operationDays: departureDay,
      runID: departure.runID,
      mode: 'regional train'
    })) || await findTrip(gtfsTimetables, departureDay, departure.origin, departure.destination, departureTimeHHMM)

    trip = await correctARTMBY(departure, trip, gtfsTimetables, departureDay)

    let tripData = {
      date: departureDay,
      runID: departure.runID,
      origin: departure.origin.slice(0, -16),
      destination: departure.destination.slice(0, -16),
      departureTime: utils.formatHHMM(departure.originDepartureTime),
      destinationArrivalTime: utils.formatHHMM(departure.destinationArrivalTime),
      consist: departure.vehicle,
    }

    if (departure.set) tripData.set = departure.set

    if (trip) {
      await handleTripShorted(trip, departure, nspTrip, liveTimetables, departureDay)
    }

    allTrips[departure.runID] = tripData
  })

  async function swap(mbyRun, artRun) {
    if (allTrips[mbyRun] || allTrips[artRun]) {
      let mby = allTrips[mbyRun], art = allTrips[artRun]
      let today = utils.getYYYYMMDDNow() // This would only activate at a reasonable hour of the day
      // In case one already departed eg 8118 usually leaves before 8116, but with TSRs we can't be sure
      if (!mby) mby = await vlineTrips.findDocument({ date: today, runID: mbyRun })
      if (!art) art = await vlineTrips.findDocument({ date: today, runID: artRun })

      // If we can't find one (eg maybe MBY is bussed but ART runs) take the tracker data as correct?
      if (art && mby && art.origin === 'Ararat' && mby.origin === 'Maryborough') {
        let artConsist = art.consist
        let mbyConsist = mby.consist
        mby.consist = artConsist
        art.consist = mbyConsist
      }
    }
  }

  await swap(8118, 8116)
  await swap(8158, 8160)

  let bulkOperations = []
  Object.keys(allTrips).forEach(runID => {
    bulkOperations.push({
      replaceOne: {
        filter: { date: allTrips[runID].date, runID },
        replacement: allTrips[runID],
        upsert: true
      }
    })
  })

  await vlineTrips.bulkWrite(bulkOperations)
}

async function requestTimings() {
  global.loggers.trackers.vline.info('requesting vline trips')
  try {
    await getDeparturesFromVNET(database)
  } catch (e) {
    global.loggers.trackers.vline.err('Error getting vline trips, skipping this round', e)
  }
}

database.connect(async () => {
  schedule([
    [210, 1380, 10]
  ], requestTimings, 'vline tracker', global.loggers.trackers.vline)
})
