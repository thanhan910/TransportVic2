const request = require('request-promise')
const TimedCache = require('timed-cache')
const async = require('async')
const urls = require('../../urls.json')
const utils = require('../../utils')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 3 })
const healthCheck = require('../health-check')
const moment = require('moment')
const cheerio = require('cheerio')
const departureUtils = require('../utils/get-train-timetables')
const getCoachReplacements = require('./get-coach-replacement-trips')
const terminiToLines = require('../../load-gtfs/vline-trains/termini-to-lines')

async function getStationFromVNETName(vnetStationName, db) {
  const station = await db.getCollection('stops').findDocument({
    bays: {
      $elemMatch: {
        mode: 'regional train',
        vnetStationName
      }
    }
  })

  return station
}

async function getVNETDepartures(station, db) {
  const vlinePlatform = station.bays.filter(bay => bay.mode === 'regional train')[0]
  const {vnetStationName} = vlinePlatform

  const body = (await request(urls.vlinePlatformDepartures.format(vnetStationName))).replace(/a:/g, '')
  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  let mappedServices = []

  await async.forEach(allServices, async service => {
    let estimatedDepartureTime

    if (!isNaN(new Date($('ActualArrivalTime', service).text()))) {
      estimatedDepartureTime = moment.tz($('ActualArrivalTime', service).text(), 'Australia/Melbourne')
    } // yes arrival cos vnet

    const platform = $('Platform', service).text()
    const originDepartureTime = moment.tz($('ScheduledDepartureTime', service).text(), 'Australia/Melbourne')
    const destinationArrivalTime = moment.tz($('ScheduledDestinationArrivalTime', service).text(), 'Australia/Melbourne')
    const runID = $('ServiceIdentifier', service).text()
    const originVNETName = $('Origin', service).text()
    const destinationVNETName = $('Destination', service).text()
    let direction = $('Direction', service).text()
    if (direction === 'D') direction = 'Down'
    else direction = 'Up'

    const originStation = await getStationFromVNETName(originVNETName, db)
    const destinationStation = await getStationFromVNETName(destinationVNETName, db)

    let originVLinePlatform = originStation.bays.filter(bay => bay.mode === 'regional train')[0]
    let destinationVLinePlatform = destinationStation.bays.filter(bay => bay.mode === 'regional train')[0]

    mappedServices.push({
      runID, originVLinePlatform, destinationVLinePlatform,
      originDepartureTime, destinationArrivalTime,
      platform, estimatedDepartureTime,
      direction
    })
  })

  return mappedServices
}

async function getDeparturesFromVNET(station, db) {
  const now = utils.now()

  const gtfsTimetables = db.getCollection('gtfs timetables')
  const timetables = db.getCollection('timetables')

  const vnetDepartures = await getVNETDepartures(station, db)
  const vlinePlatform = station.bays.filter(bay => bay.mode === 'regional train')[0]
  const minutesPastMidnight = utils.getPTMinutesPastMidnight(now)

  let mergedDepartures = (await async.map(vnetDepartures, async vnetDeparture => {
    let vnetTrip = await departureUtils.getStaticDeparture(vnetDeparture.runID, db)

    let departureHour = vnetDeparture.originDepartureTime.get('hours')
    if (departureHour < 3) departureHour += 24 // 3am PT day

    let trip = await gtfsTimetables.findDocument({
      origin: vnetDeparture.originVLinePlatform.fullStopName,
      destination: vnetDeparture.destinationVLinePlatform.fullStopName,
      departureTime: utils.formatPTHHMM(vnetDeparture.originDepartureTime),
      destinationArrivalTime: utils.formatPTHHMM(vnetDeparture.destinationArrivalTime),
      operationDays: utils.getYYYYMMDDNow(),
      mode: "regional train",
      tripStartHour: {
        $lte: departureHour
      },
      tripEndHour: {
        $gte: departureHour
      }
    })
    if (!trip) { // service disruption unaccounted for? like ptv not loading in changes into gtfs data :/
      trip = vnetTrip
      function transformDeparture() {
        let destination = vnetDeparture.destinationVLinePlatform.fullStopName.slice(0, -16)
        if (!vnetDeparture.estimatedDepartureTime) return null
        return {
          trip: {
            shortRouteName: terminiToLines[destination.slice(0, -16)] || "?",
            stopTimings: [],
            destination,
            isUncertain: true,
            direction: vnetDeparture.direction
          },
          estimatedDepartureTime: vnetDeparture.estimatedDepartureTime,
          platform: vnetDeparture.platform,
          stopData: {},
          scheduledDepartureTime: vnetDeparture.estimatedDepartureTime,
          actualDepartureTime: vnetDeparture.estimatedDepartureTime,
          departureTimeMinutes: utils.getPTMinutesPastMidnight(vnetDeparture.estimatedDepartureTime),
          runID: vnetDeparture.runID,
          unknownScheduledDepartureTime: true
        }
      }
      if (!trip) return transformDeparture()

      let tripStops = trip.stopTimings.map(stop => stop.stopName)

      let startingIndex = tripStops.indexOf(vnetDeparture.originVLinePlatform.fullStopName)
      let endingIndex = tripStops.indexOf(vnetDeparture.destinationVLinePlatform.fullStopName)
      if (startingIndex == -1) return transformDeparture()
      trip.stopTimings = trip.stopTimings.slice(startingIndex, endingIndex + 1)
      trip.origin = trip.stopTimings[0].stopName
      trip.destination = trip.stopTimings.slice(-1)[0].stopName
      trip.departureTime = trip.stopTimings[0].departureTimeMinutes
      trip.isUncertain = true
    }

    const stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === vlinePlatform.stopGTFSID)[0]

    let scheduledDepartureTime = utils.minutesAftMidnightToMoment(stopData.departureTimeMinutes, now)
    trip.destination = trip.destination.slice(0, -16)

    return {
      trip, estimatedDepartureTime: vnetDeparture.estimatedDepartureTime, platform: vnetDeparture.platform,
      stopData, scheduledDepartureTime,
      departureTimeMinutes: stopData.departureTimeMinutes, runID: vnetDeparture.runID,
      actualDepartureTime: vnetDeparture.estimatedDepartureTime || scheduledDepartureTime, vnetTrip
    }
  })).filter(Boolean)

  return mergedDepartures
}

function filterDepartures(departures) {
  let now = utils.now()

  return departures.sort((a, b) => {
    return a.actualDepartureTime - b.actualDepartureTime
  }).filter(departure => {
    if (!departure.actualDepartureTime) console.log(departure)
    return departure.actualDepartureTime.diff(now, 'seconds') > -30
  })
}

async function getDepartures(station, db) {
  if (departuresCache.get(station.stopName + 'V')) {
    return filterDepartures(departuresCache.get(station.stopName + 'V'))
  }

  let coachTrips = await getCoachReplacements(station, db)
  if (!healthCheck.isOnline()) return (await departureUtils.getScheduledDepartures(station, db, 'regional train', 180)).concat(coachTrips)

  let departures = await getDeparturesFromVNET(station, db)
  departures = departures.concat(coachTrips)

  departuresCache.put(station.stopName + 'V', departures)
  return filterDepartures(departures)
}

module.exports = getDepartures
