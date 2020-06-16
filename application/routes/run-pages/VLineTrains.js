const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')

async function pickBestTrip(data, db) {
  data.mode = 'regional train'
  let tripDay = moment.tz(data.operationDays, 'YYYYMMDD', 'Australia/Melbourne')

  let originStop = await db.getCollection('stops').findDocument({
    codedName: data.origin,
    'bays.mode': 'regional train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    codedName: data.destination,
    'bays.mode': 'regional train'
  })
  if (!originStop || !destinationStop) return null

  let query = {
    mode: 'regional train',
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays: data.operationDays
  }

  let referenceTrip

  let liveTrip = await db.getCollection('live timetables').findDocument(query)
  if (liveTrip) {
    referenceTrip = liveTrip
  } else {
    referenceTrip = await db.getCollection('gtfs timetables').findDocument(query)
    if (!referenceTrip) return null
  }

  let nspTrip = await db.getCollection('timetables').findDocument({
    mode: 'regional train',
    origin: referenceTrip.origin,
    destination: referenceTrip.destination,
    direction: referenceTrip.direction,
    routeGTFSID: referenceTrip.routeGTFSID,
    operationDays: utils.getDayName(tripDay),
    departureTime: referenceTrip.departureTime,
  })

  let {runID, vehicle} = nspTrip || {}

  let vlineTrips = db.getCollection('vline trips')
  let tripData = await vlineTrips.findDocument({
    date: data.operationDays,
    departureTime: referenceTrip.departureTime,
    origin: referenceTrip.origin.slice(0, -16),
    destination: referenceTrip.destination.slice(0, -16)
  })

  if (!tripData) {
    tripData = await vlineTrips.findDocument({
      date: data.operationDays,
      departureTime: referenceTrip.departureTime,
      origin: referenceTrip.origin.slice(0, -16)
    })
  }

  if (!tripData) {
    tripData = await vlineTrips.findDocument({
      date: data.operationDays,
      destination: referenceTrip.destination.slice(0, -16),
      destinationArrivalTime: referenceTrip.destinationArrivalTime
    })
  }

  referenceTrip.runID = runID
  referenceTrip.vehicle = vehicle

  if (tripData) {
    referenceTrip.runID = tripData.runID
    referenceTrip.consist = tripData.consist
  }

  return referenceTrip
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let trip = await pickBestTrip(req.params, res.db)
  if (!trip) return res.status(404).render('errors/no-trip')

  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.prettyTimeToArrival = ''

    let scheduledDepartureTime = moment.tz(req.params.operationDays, 'YYYYMMDD', 'Australia/Melbourne').add(stop.departureTimeMinutes || stop.arrivalTimeMinutes, 'minutes')

    const timeDifference = moment.utc(moment(scheduledDepartureTime).diff(utils.now()))

    if (+timeDifference < -30000) return stop
    if (+timeDifference <= 60000) stop.prettyTimeToArrival = 'Now'
    else {
      stop.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) stop.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) stop.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }
    return stop
  })
  res.render('runs/vline', {trip})
})

module.exports = router
