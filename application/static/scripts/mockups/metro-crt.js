function shorternName(name) {
  if (name.includes('North ')) return name.replace('North ', 'Nth ')
  if (name.includes('South ')) return name.replace('South ', 'Sth ')
  if (name === 'Melbourne Central') return 'Melb Central'
  if (name === 'Southern Cross') return 'Spencer Street'
  if (name === 'Upper Ferntree Gully') return 'Upper FT Gully'

  return name
}

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  return mainTime
}


function setListenAnnouncements() {

}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    try {
      departures = body.departures

      let firstDeparture = departures[0]
      if (!firstDeparture) return setListenAnnouncements()

      let destination = firstDeparture.destination.toUpperCase()
      if (firstDeparture.trip.routeGTFSID === '2-CCL') destination = 'CITY CIRCLE'

      $('.destination span').textContent = destination
      $('.departureInfo .scheduledDepartureTime').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))

      if (firstDeparture.estimatedDepartureTime) {
        if (firstDeparture.minutesToDeparture > 0) {
          $('.departureInfo .departingMinutes').textContent = firstDeparture.minutesToDeparture
          $('.min').textContent = 'MIN'
        } else {
          $('.departureInfo .departingMinutes').textContent = 'NOW'
          $('.min').textContent = ''
        }
      } else {
        $('.departureInfo .departingMinutes').textContent = '-- '
        $('.min').textContent = 'MIN'
      }

      let stops = firstDeparture.additionalInfo.screenStops

      function getHTML(stops) {
        return stops.map(stop => `<span>${stop.isExpress ? '- - -' : shorternName(stop.stopName).toUpperCase()}</span>`).join('')
      }

      if (stops.length > 16) {
        let firstLeft = stops.slice(0, 8)
        let firstRight = stops.slice(8, 16)

        let remaining = stops.slice(16)
        let leftSize = remaining.length > 10 ? Math.ceil(remaining.length / 2) : 8
        let secondLeft = remaining.slice(0, leftSize)
        let secondRight = remaining.slice(leftSize)

        $('.leftCRT .stops .left').innerHTML = getHTML(firstLeft)
        $('.leftCRT .stops .right').innerHTML = getHTML(firstRight)

        $('.rightCRT .stops .left').innerHTML = getHTML(secondLeft)
        $('.rightCRT .stops .right').innerHTML = getHTML(secondRight)
      } else if (stops.length > 12) {
        let leftSize = Math.ceil(stops.length / 2)

        let firstLeft = stops.slice(0, leftSize)
        let firstRight = stops.slice(leftSize)
        $('.leftCRT .stops .left').innerHTML = getHTML(firstLeft)
        $('.leftCRT .stops .right').innerHTML = getHTML(firstRight)
      } else {
        let firstLeft = stops.slice(0, 8)
        let firstRight = stops.slice(8)
        $('.leftCRT .stops .left').innerHTML = getHTML(firstLeft)
        $('.leftCRT .stops .right').innerHTML = getHTML(firstRight)
      }

      let secondDeparture
      if (secondDeparture = departures[1]) {
        $('.nextDeparture .scheduledDepartureTime').textContent = formatTime(new Date(secondDeparture.scheduledDepartureTime))
        $('.nextDeparture .destination').textContent = secondDeparture.destination.toUpperCase()

        if (secondDeparture.estimatedDepartureTime) {
          if (secondDeparture.minutesToDeparture > 0) {
            $('.nextDeparture .departingMinutes').textContent = secondDeparture.minutesToDeparture + ' MIN'
          } else {
            $('.nextDeparture .departingMinutes').textContent = 'NOW'
          }
        } else {
          $('.nextDeparture .departingMinutes').textContent = ''
        }
      } else {
        $('.nextDeparture .scheduledDepartureTime').textContent = '--'
        $('.nextDeparture .destination').textContent = '--'
        $('.nextDeparture .departingMinutes').textContent = ''
      }
    } catch (e) {}
  })
}
$.ready(() => {
  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})
