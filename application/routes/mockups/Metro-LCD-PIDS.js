const express = require('express')
const router = new express.Router()
const utils = require('../../../utils')
const TrainUtils = require('./TrainUtils')

let stoppingTextMap = {
  stopsAll: 'Stops All Stations',
  allExcept: 'Not Stopping At {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  thenRunsExpressAtoB: 'then Runs Express from {0} to {1}',
  sasTo: 'Stops All Stations to {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}

let stoppingTypeMap = {
  vlineService: {
    stoppingType: 'No Suburban Passengers'
  },
  sas: 'Stops All',
  limExp: 'Limited Express',
  exp: 'Express'
}

async function getData(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  return await TrainUtils.getPIDSDepartures(res.db, station, req.params.platform, stoppingTextMap, stoppingTypeMap)
}

router.get('/:station/:platform', async (req, res) => {
  res.render('mockups/metro-lcd-pids/pids', { now: utils.now() })
})

router.get('/:station/:platform/list', async (req, res) => {
  res.render('mockups/metro-lcd-pids/list-pids', { now: utils.now() })
})

router.get('/:station/:platform/16-9-list', async (req, res) => {
  res.render('mockups/metro-lcd-pids/16-9-list-pids', { now: utils.now() })
})

router.post('/:station/:platform/:type*?', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

module.exports = router
