const async = require('async')
const utils = require('../../utils')

module.exports = async function(routeData, shapeData, routes, operator, mode, adjustRouteName=n=>n, nameFilter=()=>true, getFlags=()=>null) {
  await routes.createIndex({
    routeName: 1
  }, {name: 'route name index'})

  await routes.createIndex({
    routeNumber: 1
  }, {name: 'route number index'})

  await routes.createIndex({
    routeGTFSID: 1
  }, {name: 'route gtfs id index', unique: true})


  const allRoutes = routeData.map(values => {
    let simplifiedRouteGTFSID = utils.simplifyRouteGTFSID(values[0])
    let adjustedRouteName = adjustRouteName(values[3], simplifiedRouteGTFSID)
    let shortRouteName = null

    let routeNumber = values[2]

    if (adjustedRouteName instanceof Array) {
      shortRouteName = adjustedRouteName[1]
      adjustedRouteName = adjustedRouteName[0]
    }

    return {
      routeGTFSID: simplifiedRouteGTFSID,
      fullGTFSID: values[0],
      routeName: adjustedRouteName,
      shortRouteName,
      routeNumber
    }
  })

  const mergedRoutes = {}

  allRoutes.forEach(route => {
    // console.log(route.routeName, route.shortRouteName, route.routeGTFSID)
    if (!nameFilter(route.routeName)) return
    if (!mergedRoutes[route.routeGTFSID]) {
      mergedRoutes[route.routeGTFSID] = {
        routeNumber: route.routeNumber,
        routeName: route.routeName,
        codedName: utils.encodeName(route.routeName),
        routeGTFSID: route.routeGTFSID,
        operators: operator(route.routeName, route.routeGTFSID, route.routeNumber),
        directions: [],
        mode
      }

      if (route.shortRouteName) mergedRoutes[route.routeGTFSID].shortRouteName = route.shortRouteName
    } else {
      if (route.routeName.length > mergedRoutes[route.routeGTFSID].routeName.length) {
        mergedRoutes[route.routeGTFSID].routeName = route.routeName
        if (route.shortRouteName) mergedRoutes[route.routeGTFSID].shortRouteName = route.shortRouteName
      }
    }
  })

  await async.forEach(Object.values(mergedRoutes), async mergedRouteData => {
    let routeTypes = {}
    let routeLengths = {}
    let mergedRouteTypes = {}

    shapeData.filter(data => data[0].startsWith(mergedRouteData.routeGTFSID)).forEach(line => {
      let id = line[0]
      if (!routeTypes[id]) routeTypes[id] = []
      routeTypes[id].push(line)
    })

    Object.keys(routeTypes).forEach(routeGTFSID => {
      let shapeData = routeTypes[routeGTFSID].filter((line, i, a) => {
        if (a[i - 1])
          return a[i - 1][4] !== line[4]
        return true
      }).map(line => [parseFloat(line[2]), parseFloat(line[1])])
      let routeKey = routeTypes[routeGTFSID].slice(-1)[0][4] + shapeData[0].join(',') + shapeData.slice(-1)[0].join(',')
      routeTypes[routeGTFSID] = shapeData

      if (!routeLengths[routeKey])
        routeLengths[routeKey] = []

      routeLengths[routeKey].push(routeGTFSID)
    })

    Object.keys(routeLengths).forEach(length => {
      mergedRouteTypes[routeLengths[length].join(',')] = routeTypes[routeLengths[length][0]]
    })

    mergedRoutes[mergedRouteData.routeGTFSID].routePath = Object.keys(mergedRouteTypes).reduce((acc, key) => {
      return acc.concat({
        fullGTFSIDs: key.split(','),
        path: mergedRouteTypes[key]
      })
    }, [])

    let flags = getFlags(mergedRouteData.routeGTFSID)
    if (flags)
      mergedRouteData.flags = flags

    await routes.replaceDocument({ routeGTFSID: mergedRouteData.routeGTFSID }, mergedRouteData, {
      upsert: true
    })
  })

  return Object.keys(mergedRoutes).length
}
