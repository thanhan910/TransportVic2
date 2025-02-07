const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const router = new express.Router()
const url = require('url')
const path = require('path')
const fs = require('fs')
const querystring = require('querystring')
const modules = require('../../../modules')

const departureUtils = require('../../../modules/utils/get-train-timetables-new')

const stationCodes = require('../../../additional-data/station-codes')
const rawLineRanges = require('../../../additional-data/metro-tracker/line-ranges')
const lineGroups = require('../../../additional-data/metro-tracker/line-groups')

const metroTypes = require('../../../additional-data/metro-tracker/metro-types')
const metroConsists = require('../../../additional-data/metro-tracker/metro-consists')

let stationCodeLookup = {}

Object.keys(stationCodes).forEach(stationCode => {
  stationCodeLookup[stationCodes[stationCode]] = stationCode
})

function generateQuery(type) {
  let matchedMCars = metroConsists.filter(consist => consist.type === type).map(consist => consist.leadingCar)
  return metroConsists.filter(consist => matchedMCars.includes(consist[0]))
}

let comengQuery = { $in: generateQuery('Comeng') }
let siemensQuery = { $in: generateQuery('Siemens') }
let xtrapQuery = { $in: generateQuery('Xtrapolis') }

let lineRanges = {}

let lineGroupCodes = {
  'Caulfield': 'CFD',
  'Clifton Hill': 'CHL',
  'Burnley': 'BLY',
  'Northern': 'NTH'
}

let typeCode = {
  'Direct': 'direct',
  'Via BLY Loop': 'via_BLYLoop',
  'Via NTH Loop': 'via_NTHLoop',
  'Via CHL Loop': 'via_CHLLoop',
  'Via CFD Loop': 'via_CFDLoop',
  'Via City Circle': 'via_ccl',
  'NME Via SSS Direct': 'nme_viasss'
}

Object.keys(rawLineRanges).forEach(line => {
  let ranges = rawLineRanges[line]
  lineRanges[line] = ranges.map(range => {
    let lower = range[0]
    let upper = range[1]
    let prefix = range[2] || ''
    let numbers = []
    for (let n = lower; n <= upper; n++) {
      if (n < 1000) {
        n = utils.pad(n.toString(), prefix ? 3 : 4, '0')
      }
      numbers.push(prefix + n)
    }
    return numbers
  }).reduce((a, e) => a.concat(e), [])
})

router.get('/', (req, res) => {
  res.render('tracker/metro/index')
})

function adjustTrip(trip, date, today, minutesPastMidnightNow) {
  let e = utils.encodeName
  let {departureTime, destinationArrivalTime} = trip
  let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime),
      destinationArrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(destinationArrivalTime)

  let tripDate = trip.date

  if (departureTimeMinutes < 180) {
    departureTimeMinutes += 1440
    tripDate = utils.getYYYYMMDD(utils.parseDate(tripDate).add(1, 'day'))
  }

  if (destinationArrivalTimeMinutes < departureTimeMinutes) destinationArrivalTimeMinutes += 1440

  trip.url = `/metro/run/${e(trip.origin)}/${trip.departureTime}/${e(trip.destination)}/${trip.destinationArrivalTime}/${tripDate}`

  trip.departureTimeMinutes = departureTimeMinutes
  trip.active = minutesPastMidnightNow <= destinationArrivalTimeMinutes || date !== today

  return trip
}

router.get('/date', async (req, res) => {
  let {db} = res
  let metroTrips = db.getCollection('metro trips')

  let today = utils.getYYYYMMDDNow()
  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await metroTrips.findDocuments({ date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/metro/by-date', {
    trips,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/line', async (req, res) => {
  let {db} = res
  let metroTrips = db.getCollection('metro trips')
  let liveTimetables = db.getCollection('live timetables')

  let today = utils.getYYYYMMDDNow()
  let {date, line} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let baseLineRanges = lineRanges[line] || []

  let additionalTDNs = await liveTimetables.distinct('runID', {
    operationDays: date,
    routeName: line
  })

  let trips = (await metroTrips.findDocuments({
    date,
    runID: {
      $in: baseLineRanges.concat(additionalTDNs)
    }
  }).sort({destination: 1}).toArray())
  .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
  .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  res.render('tracker/metro/by-line', {
    trips,
    line,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

router.get('/consist', async (req, res) => {
  let {db} = res
  let metroTrips = db.getCollection('metro trips')
  let today = utils.getYYYYMMDDNow()
  let {consist, date} = querystring.parse(url.parse(req.url).query)
  if (date) date = utils.getYYYYMMDD(utils.parseDate(date))
  else date = today

  let minutesPastMidnightNow = utils.getMinutesPastMidnightNow()

  let trips = (await metroTrips.findDocuments({ consist, date })
    .sort({destination: 1}).toArray())
    .map(trip => adjustTrip(trip, date, today, minutesPastMidnightNow))
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  let rawServicesByDay = await metroTrips.aggregate([{
    $match: {
      consist,
    }
  }, {
    $group: {
      _id: '$date',
      services: {
        $addToSet: '$runID'
      }
    }
  }, {
    $sort: {
      _id: -1
    }
  }]).toArray()

  let servicesByDay = rawServicesByDay.map(data => {
    let date = data._id
    let humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)

    return {
      date,
      humanDate,
      services: data.services.sort((a, b) => a.localeCompare(b))
    }
  })

  res.render('tracker/metro/by-consist', {
    trips,
    consist,
    servicesByDay,
    date: utils.parseTime(date, 'YYYYMMDD')
  })
})

module.exports = router
