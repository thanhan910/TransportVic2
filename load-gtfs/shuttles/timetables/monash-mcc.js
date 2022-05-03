const utils = require('../../../utils')

function dateRange(name, start, end, type) {
  let startDate = utils.parseDate(start)
  let endDate = utils.parseDate(end)

  let allDatesInbetween = utils.allDaysBetweenDates(startDate, endDate)

  return allDatesInbetween.map(date => {
    return [name, utils.getYYYYMMDD(date), type]
  })
}

let generateExclusion = (name, start, end) => dateRange(name, start, end, '2')
let generateInclusion = (name, start, end) => dateRange(name, start, end, '1')

let MONASH_CLAYTON = '19808'
let MONASH_CAULFIELD = '12000006'
let ROUTE_GTFS_ID = '12-MCC'

let baseDownTripTimes = [
  {
    'stopGTFSID': MONASH_CAULFIELD,
    'departureTimeMinutes': 0
  },
  {
    'stopGTFSID': MONASH_CLAYTON,
    'departureTimeMinutes': 20
  }
]

let baseUpTripTimes = [
  {
    'stopGTFSID': MONASH_CLAYTON,
    'departureTimeMinutes': 0
  },
  {
    'stopGTFSID': MONASH_CAULFIELD,
    'departureTimeMinutes': 20
  }
]

function generateTripTimes(direction, departureTime, tripID) {
  let baseTrip = direction === 'Up' ? baseUpTripTimes : baseDownTripTimes
  return {
    tripID,
    stopTimings: baseTrip.map(stop => {
      let minutesPastMidnight = stop.departureTimeMinutes + departureTime
      let time = utils.getHHMMFromMinutesPastMidnight(minutesPastMidnight) + ':00'
      return {
        'stopGTFSID': stop.stopGTFSID,
        'arrivalTime': time,
        'departureTime': time,
        'stopConditions': {
          'dropoff': 0, 'pickup': 0
        },
        'stopDistance': 0,
        'stopSequence': 0
      }
    })
  }
}

function addTrip(direction, departureHour, departureMinute, headsign) {
  let shapeID = `${ROUTE_GTFS_ID}-mjp-1.1.${direction === 'Down' ? 'H' : 'R'}`
  let tripID = `${utils.pad(departureHour, 2)}${utils.pad(departureMinute, 2)}.${shapeID}`

  module.exports.trips.push({
    'mode': 'bus',
    'routeGTFSID': ROUTE_GTFS_ID,
    'calendarID': 'WEEKDAY',
    'tripID': tripID,
    'gtfsDirection': direction === 'Down' ? '0' : '1',
    'shapeID': shapeID,
    'headsign': headsign
  })

  module.exports.timings.push(generateTripTimes(direction, departureHour * 60 + departureMinute, tripID))
}

module.exports = {
  'days': [
    ['WEEKDAY', '1', '1', '1', '1', '1', '0', '0', '20220214', '20221118']
  ],
  'dates': [
    ...generateExclusion('WEEKDAY', '20220625', '20220717')
  ],
  'trips': [],
  'timings': []
}

addTrip('Up', 7, 20, 'Monash University Caulfield')
addTrip('Up', 7, 40, 'Monash University Caulfield')
for (let hour = 8; hour <= 18; hour++) {
  addTrip('Up', hour,  0, 'Monash University Caulfield')
  addTrip('Up', hour, 20, 'Monash University Caulfield')
  addTrip('Up', hour, 40, 'Monash University Caulfield')
}
for (let hour = 19; hour <= 21; hour++) {
  addTrip('Up', hour,  0, 'Monash University Caulfield')
  addTrip('Up', hour, 30, 'Monash University Caulfield')
}
addTrip('Up', 22,  0, 'Monash University Caulfield')



for (let hour = 7; hour <= 17; hour++) {
  addTrip('Down', hour, 10, 'Monash University Clayton')
  addTrip('Down', hour, 30, 'Monash University Clayton')
  addTrip('Down', hour, 50, 'Monash University Clayton')
}
addTrip('Down', 18, 10, 'Monash University Clayton')
addTrip('Down', 18, 30, 'Monash University Clayton')
for (let hour = 19; hour <= 21; hour++) {
  addTrip('Down', hour,  0, 'Monash University Clayton')
  addTrip('Down', hour, 30, 'Monash University Clayton')
}
addTrip('Down', 22,  0, 'Monash University Clayton')
