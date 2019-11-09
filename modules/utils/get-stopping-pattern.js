const async = require('async')
const moment = require('moment')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const busStopNameModifier = require('../../load-gtfs/metro-bus/bus-stop-name-modifier')

let modes = {
  'metro train': 0,
  'regional train': 3,
  'regional coach': 3,
  'bus': 2,
  'nbus': 4,
  'tram': 1
}

module.exports = async function (db, ptvRunID, mode, time, stopID) {
  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/${modes[mode]}?expand=stop&expand=run&expand=route`
  if (time)
    url += `&date_utc=${time}`
  if (stopID)
    url += `&stop_id=${stopID}`

  let {departures, stops, runs, routes} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  if (mode === 'nbus') mode = 'bus'

  departures = departures.map(departure => {
    departure.actualDepartureTime = moment.tz(departure.estimated_departure_utc || departure.scheduled_departure_utc, 'Australia/Melbourne')
    departure.scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    departure.estimatedDepartureTime = moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne')
    return departure
  }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  let dbStops = {}
  let checkModes = [mode]
  if (mode === 'regional coach') checkModes.push('regional train')

  await async.forEach(Object.values(stops), async stop => {
    let stopName = stop.stop_name.trim()
    if (mode === 'metro train') {
      if (stopName === 'Jolimont-MCG')
        stopName = 'Jolimont'

      stopName += ' Railway Station'
    }
    stopName = utils.adjustRawStopName(busStopNameModifier(utils.adjustStopname(stopName)))
      .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')

    let dbStop = await stopsCollection.findDocument({
      $or: [{
        'bays.fullStopName': stopName
      }, {
        stopName,
      }],
      'bays.mode': { $in: checkModes }
    })
    if (!dbStop) console.log(stopName)
    dbStops[stop.stop_id] = dbStop
  })

  let stopTimings = departures.map((departure, i) => {
    let {
      estimatedDepartureTime, scheduledDepartureTime,
      stop_id, platform_number} = departure

    let stopBay = dbStops[stop_id].bays
      .filter(bay => {
        let ptvStop = stops[stop_id]
        let stopName = utils.adjustRawStopName(busStopNameModifier(utils.adjustStopname(ptvStop.stop_name.trim())))
          .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')

        return checkModes.includes(bay.mode) && bay.fullStopName === stopName
      })[0]
    if (!stopBay) {
      stopBay = dbStops[stop_id].bays
        .filter(bay => checkModes.includes(bay.mode))[0]
    }

    let departureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    let stopTiming = {
      stopName: stopBay.fullStopName,
      stopNumber: stopBay.stopNumber,
      stopGTFSID: stopBay.stopGTFSID,
      arrivalTime: scheduledDepartureTime.format("HH:mm"),
      arrivalTimeMinutes: departureTimeMinutes,
      departureTime: scheduledDepartureTime.format("HH:mm"),
      departureTimeMinutes: departureTimeMinutes,
      estimatedDepartureTime: departure.estimated_departure_utc ? estimatedDepartureTime.toISOString() : null,
      platform: platform_number,
      stopConditions: ""
    }

    if (i == 0) {
      stopTiming.arrivalTime = null
      stopTiming.arrivalTimeMinutes = null
    } else if (i == departures.length - 1) {
      stopTiming.departureTime = null
      stopTiming.departureTimeMinutes = null
    }

    return stopTiming
  })

  let routeData = Object.values(routes)[0]

  let vehicleDescriptor = run.vehicle_descriptor || {}

  let routeGTFSID = routeData.route_gtfs_id
  if (mode === 'regional coach')
    routeGTFSID = '5-' + routeGTFSID.slice(2)

  let timetable = {
    mode, routeName: routeData.route_name.trim(),
    routeGTFSID,
    runID: vehicleDescriptor.id,
    operationDays: [utils.getYYYYMMDDNow()],
    vehicle: vehicleDescriptor.description || vehicleDescriptor.id,
    stopTimings: stopTimings.sort((a, b) => (a.arrivalTimeMinutes || a.departureTimeMinutes) - (b.arrivalTimeMinutes || b.departureTimeMinutes)),
    destination: stopTimings[stopTimings.length - 1].stopName,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].arrivalTime,
    departureTime: stopTimings[0].departureTime,
    origin: stopTimings[0].stopName,
    type: "timings",
    updateTime: new Date()
  }

  let key = {
    mode, routeName: timetable.routeName,
    operationDays: timetable.operationDays,
    departureTime: timetable.departureTime,
    destinationArrivalTime: timetable.destinationArrivalTime
  }

  await liveTimetables.replaceDocument(key, timetable, {
    upsert: true
  })

  return timetable
}
