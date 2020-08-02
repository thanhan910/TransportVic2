const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/ferry/get-departures')
const moment = require('moment')
const utils = require('../../../utils')
const async = require('async')

async function loadDepartures(req, res) {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    codedName: req.params.stopName
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'ferry')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(stop, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.actualDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      let minutesToDeparture = timeDifference.get('hours') * 60 + timeDifference.get('minutes')
      departure.prettyTimeToArrival = minutesToDeparture + ' m'
    }

    departure.headwayDevianceClass = 'unknown'
    departure.codedLineName = 'ferry'

    let day = utils.getYYYYMMDD(departure.scheduledDepartureTime)

    departure.tripURL = `/ferry/run/${utils.encodeName(departure.trip.origin)}/${departure.trip.departureTime}/`
      + `${utils.encodeName(departure.trip.destination)}/${departure.trip.destinationArrivalTime}/`
      + `${day}#stop-${departure.trip.stopTimings[0].stopGTFSID}`

    departure.destination = utils.getStopName(departure.trip.destination)
    departure.destinationURL = `/ferry/timings/${utils.encodeName(departure.trip.destination)}`

    return departure
  })

  return { departures, stop }
}

router.get('/:stopName', async (req, res) => {
  res.render('timings/ferry', await loadDepartures(req, res))
})

router.post('/:stopName', async (req, res) => {
  res.render('timings/templates/ferry', await loadDepartures(req, res))
})

module.exports = router
