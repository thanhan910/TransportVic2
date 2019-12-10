const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const querystring = require('querystring')

const operators = {
  "Ventura Bus Lines": "V",
  "CDC Melbourne": {
    $in: ["CO", "CS", "CW"]
  },
  "Tullamarine Bus Lines": "CT",
  "CDC Geelong": "CG",
  "CDC Ballarat": "CB",
  "Transdev Melbourne": "T",
  "Sita Bus Lines": "S",
  "Dysons": "D",
  "Cranbourne Transit": "CR",
  "Sunbury Bus Service": "SB",
  "Latrobe Valley Bus Lines": "LT",
  "McHarrys Bus Lines": "MH",
  "McKenzies Tourist Service": "MK",
  "Martyrs Bus Service": "MT",
  "Ryan Bros Bus Service": "RB",
  "Moreland Bus Lines": "ML",
  "Moonee Valley Bus Lines": "MV",
  "Kastoria Bus Lines": "K",
  "Broadmeadows Bus Service": "B",
  "Panorama Coaches": "P"
}

router.get('/', (req, res) => {
  res.render('tracker/index', {
    operators: Object.keys(operators)
  })
})

router.get('/bus', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {fleet} = querystring.parse(url.parse(req.url).query)
  if (!fleet) return res.end()

  let bus = await smartrakIDs.findDocument({ fleetNumber: fleet })
  let query = { date }

  let smartrakID

  if (bus) smartrakID = bus.smartrakID
  else smartrakID = parseInt(fleet)

  query.smartrakID = smartrakID
  let tripsToday = await busTrips.findDocuments(query)
    .sort({departureTime: 1}).toArray()

  let operationDays = await busTrips.distinct('date', {
    smartrakID
  })
  let servicesByDay = {}

  await async.forEach(operationDays, async date => {
    servicesByDay[date] = await busTrips.distinct('routeNumber', {
      smartrakID, date
    })
  })

  res.render('tracker/bus', {tripsToday, servicesByDay, bus, fleet, date})
})

router.get('/service', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {service} = querystring.parse(url.parse(req.url).query)
  if (!service) return res.end()

  let originalService = service
  service = {
    $in: service.split('|')
  }

  let rawTripsToday = await busTrips.findDocuments({
    date,
    routeNumber: service
  }).sort({departureTime: 1, origin: 1}).toArray()

  let activeTripsNow = rawTripsToday.filter(trip => {
    let {departureTime, destinationArrivalTime} = trip
    let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime),
        destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(destinationArrivalTime)

    return minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  let tripsToday = (await async.map(activeTripsNow, async rawTrip => {
    let {fleetNumber} = await smartrakIDs.findDocument({
      smartrakID: rawTrip.smartrakID
    }) || {}

    let {origin, destination, departureTime} = rawTrip

    rawTrip.fleetNumber = fleetNumber ? '#' + fleetNumber : '@' + rawTrip.smartrakID
    return rawTrip
  }))

  let operationDays = await busTrips.distinct('date', {
    routeNumber: service
  })
  let busesByDay = {}
  let smartrakIDCache = {}

  await async.forEach(operationDays, async date => {
    let smartrakIDsByDate = await busTrips.distinct('smartrakID', {
      date,
      routeNumber: service
    })
    let buses = (await async.map(smartrakIDsByDate, async smartrakID => {
      let fleetNumber = smartrakIDCache[smartrakID]
      if (!fleetNumber) {
        let lookup = await smartrakIDs.findDocument({
          smartrakID
        })
        if (lookup) {
          fleetNumber = lookup.fleetNumber
          smartrakIDCache[smartrakID] = fleetNumber
        }
      }
      return fleetNumber ? '#' + fleetNumber : '@' + smartrakID
    })).sort((a, b) => a.replace(/[^\d]/g, '') - b.replace(/[^\d]/g, ''))

    busesByDay[date] = buses
  })

  res.render('tracker/service', {tripsToday, busesByDay, date, service: originalService})
})

router.get('/unknown', async (req, res) => {
  let {db} = res
  let busTrips = db.getCollection('bus trips')
  let smartrakIDs = db.getCollection('smartrak ids')
  let routes = db.getCollection('routes')
  let date = utils.getYYYYMMDDNow()
  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let {operator} = querystring.parse(url.parse(req.url).query)
  if (!operator) return res.end()

  let operatorCode = operators[operator]
  let operatorBuses = await smartrakIDs.distinct('smartrakID', {
    operator: operatorCode
  })

  let operatorServices = await routes.distinct('routeGTFSID', {
    operators: operator
  })

  let rawTripsToday = await busTrips.findDocuments({
    date,
    routeGTFSID: {
      $in: operatorServices
    },
    smartrakID: {
      $not: {
        $in: operatorBuses
      }
    }
  }).sort({departureTime: 1, origin: 1}).toArray()

  let activeTripsNow = rawTripsToday.filter(trip => {
    let destinationArrivalTimeMinutes = utils.time24ToMinAftMidnight(trip.destinationArrivalTime)

    return minutesPastMidnightNow <= destinationArrivalTimeMinutes
  })

  res.render('tracker/unknown', {activeTripsNow})
})

module.exports = router
