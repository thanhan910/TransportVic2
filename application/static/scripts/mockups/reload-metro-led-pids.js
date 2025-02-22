window.topRow = null
window.bottomRow = null

let EDSFormats = {}
let EDSData = {}
let EDSImages = {}

let width = 120
let height = 7
let ledSize = 0.007
let font

let bottomRowTimeout = 0
let pauseTimeout = 0
let bottomRowText = []
let stopScrolling = false

function generateLEDCssCode() {
    let cssData =
`
    .led {
        width: ${Math.ceil(window.innerWidth * ledSize)}px;
        height: ${Math.ceil(window.innerWidth * ledSize)}px;
        border-radius: ${Math.ceil(window.innerWidth * ledSize)}px;
    }

    .pids {
        width: ${width * Math.ceil(window.innerWidth * ledSize)}px;
        grid-template-columns: repeat(${width}, ${Math.ceil(window.innerWidth * ledSize)}px);
        grid-row-gap: ${Math.ceil(window.innerWidth * 0.001)}px;
        grid-auto-rows: ${Math.ceil(window.innerWidth * ledSize) - 1}px;
    }
`

    $('#led-style').textContent = cssData
}

function legacyDrawText(matrix, text, spacing, x, y) {
    matrix.clearRectangle(0, 0, 120, 7)
    matrix.drawText(new TextObject(text, font, new Position(x, y), spacing));
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

function shortenDestination(destination) {
  if (destination === 'Flinders Street') {
    return 'FLINDERS ST'
  }
  if (destination === 'Southern Cross') {
    return 'STHN CROSS'
  }
  if (destination === 'North Melbourne') {
    return 'NTH MELBOURNE'
  }
  if (destination === 'Upper Ferntree Gully') {
    return 'UPPER FT GULLY'
  }
  if (destination === 'Sydney Central') {
    return 'SYDNEY XPT'
  }
  return destination.toUpperCase()
}

function checkAndUpdateTrains() {
  $.ajax({
    method: 'POST'
  }, (err, status, data) => {
    if (!data) {
      stopScrolling = true
      clearTimeout(bottomRowTimeout)
      clearTimeout(pauseTimeout)
      bottomRowText = []

      legacyDrawText(topRow, 'LISTEN FOR', 1, 0, 0)
      legacyDrawText(bottomRow, 'ANNOUNCEMENTS', 1, 0, 0)
      return
    }
    let nextDeparture = data.dep[0]
    if (nextDeparture) {
      let scheduledDepartureTime = nextDeparture.sch
      let estimatedDepartureTime = nextDeparture.est
      let destination = nextDeparture.dest

      legacyDrawText(topRow, `${formatTime(new Date(scheduledDepartureTime))} ${shortenDestination(destination)}`, 1, 0, 0)

      let timeDiff = new Date(estimatedDepartureTime) - new Date()
      let minutes = timeDiff / 1000 / 60

      if (estimatedDepartureTime) {
        minutes = Math.floor(minutes).toString()
        if (timeDiff <= 1000 * 45) minutes = 'NOW'

        let timeToDepart = new TextObject(minutes, font, new Position(0, 0), 1)

        timeToDepart.position.x = 120 - timeToDepart.width - 3
        topRow.drawText(timeToDepart)
      }

      bottomRowText = [nextDeparture.type]
      if (nextDeparture.type !== 'Stops All Stations' && nextDeparture.type !== 'Not Taking Passengers') {
        bottomRowText.push(nextDeparture.txt)
      }
    } else {
      if (data.bus.length) {
        legacyDrawText(topRow, 'NO TRAINS OPERATING', 1, 0, 0)
        bottomRowText = ['REPLACEMENT BUSES', 'HAVE BEEN ARRANGED']
      } else if (data.has) {
        legacyDrawText(topRow, 'NO TRAINS DEPART', 1, 0, 0)
        legacyDrawText(bottomRow, 'FROM THIS PLATFORM', 1, 0, 0)
        bottomRowText = []
      } else {
        legacyDrawText(topRow, 'NO TRAINS DEPARTING', 1, 0, 0)
        legacyDrawText(bottomRow, 'CHECK TIMETABLES', 1, 0, 0)
        bottomRowText = []
      }
    }

    stopScrolling = true
    clearTimeout(bottomRowTimeout)
    clearTimeout(pauseTimeout)
    drawBottomRow()
  })
}

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

async function animateScrollingText(matrix, text, spacing, xPosition=0) {
  let textObj = new TextObject(text, font, new Position(xPosition, 0), spacing)
  let textWidth = textObj.width

  let iterationCount = textWidth - xPosition + 20

  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling) {
      stopScrolling = false
      return
    }
    matrix.clearRectangle(xPosition, 0, 120, 7)
    matrix.drawText(textObj)
    textObj.position.x--
    await asyncPause(15)
  }
}

function drawBottomRow() {
  let widths = bottomRowText.map(e => new TextObject(e, font, new Position(0, 0), 1).width)
  if (bottomRowText.length === 0) return
  if (bottomRowText.length === 1) {
    legacyDrawText(bottomRow, bottomRowText[0], 1, 0, 0)
  } else {
    let spacingRequired = bottomRow.width - widths[0]
    let spacesRequired = Math.ceil(spacingRequired / 5)
    legacyDrawText(bottomRow, bottomRowText[0], 1, 0, 0)

    let combinedText = bottomRowText[0]
    for (let i = 0; i < spacesRequired; i++) combinedText += ' '
    combinedText += bottomRowText[1]

    bottomRowTimeout = setTimeout(async () => {
      await animateScrollingText(bottomRow, combinedText, 1, 0)
      drawBottomRow()
    }, 4000)
  }
}

$.ready(() => {
  generateLEDCssCode()

  font = Font.fromNameString('Metro-PIDS-7:5')

  topRow = new LEDMatrix(width, height, $('#top-pids'))
  bottomRow = new LEDMatrix(width, height, $('#bottom-pids'))

  legacyDrawText(topRow, 'CHECKING TRAINS...', 1, 0, 0)
  legacyDrawText(bottomRow, 'PLEASE WAIT', 1, 0, 0)

  checkAndUpdateTrains()
  setTimeout(() => {
    checkAndUpdateTrains()
    setInterval(checkAndUpdateTrains, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})

window.addEventListener('resize', generateLEDCssCode);
