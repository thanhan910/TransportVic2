module.exports = [{
  name: 'Ventura Minibuses',
  track: ['V376', 'V377', 'V715', 'V716', 'V717', 'V718', 'V719', 'V720', 'V721', 'V722', 'V724', 'V736', 'V740', 'V741', 'V744', 'V745', 'V746', 'V826', 'V1074', 'V1075', 'V1076', 'V1077', 'V1079', 'V1080', 'V1081', 'V1082', 'V1083', 'V1084', 'V1085', 'V1086', 'V1087', 'V1268', 'V1269', 'V1270', 'V1310', 'V1311', 'V1377', 'V1408'],
  routes: ['526', '527', '548', '549', '550', '551', '671', '672', '673', '676', '677', '680', '786', '787', '886', '887', 'TB1', 'TB2', 'TB3', 'TB4', 'TB7', 'TB8', 'TB9'],
  type: 'exclude'
}, {
  name: 'Ventura Artics',
  track: ['V100', 'V102', 'V136', 'V143', 'V190', 'V292', 'V293', 'V294', 'V730', 'V732', 'V733', 'V734', 'V735', 'V842', 'V1271', 'V1374', 'V1378', 'V1379', 'V1380', 'V1422', 'V1423'],
  routes: ['811', '812', '813', '843', '664', '670', '679', '788'],
  type: 'exclude'
}, {
  name: 'Ventura Specials',
  track: ['V187', 'V197', 'V198', 'V287', 'V322', 'V784', 'V785', 'V786', 'V787', 'V789', 'V792', 'V795', 'V796', 'V1175', 'V1176', 'V1182', 'V1184', 'V1194', 'V1195', 'V1380', 'V1445'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Ventura CB80',
  track: ['V993'],
  routes: ['697', '699', '735', '736', '757', '765', '768'],
  type: 'include'
}, {
  name: 'Venture B10BLE',
  track: ['V10', 'V30', 'V31', 'V34', 'V35', 'V43', 'V44', 'V78', 'V114', 'V116', 'V137', 'V138', 'V139', 'V304'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Transdev Minibuses',
  track: ['T119', 'T120', 'T129', 'T130', 'T131', 'T132', 'T133', 'T183'],
  routes: ['280', '282', '370'],
  type: 'exclude'
}, {
  name: 'Transdev Specials',
  track: ['T737', 'T738', 'T739'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Cranbourne O405NH',
  track: ['CR32', 'CR33', 'CR34', 'CR35'],
  routes: ['795', '891', '894', '895'],
  type: 'include'
}, {
  name: 'Cranbourne Specials',
  track: ['CR36', 'CR37'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Route Livery Buses',
  track: ['S16' ,'S19', 'S27', 'S40', 'S41', 'S43', 'S54', 'S71', 'CO127', 'CO128', 'CO129', 'CO130', 'CO154', 'CO171', 'D897', 'D898', 'D899', 'D900', 'V1255', 'V1256'],
  routes: ['201', '301', '401', '601'],
  type: 'exclude'
}, {
  name: 'Non-Perm Route Livery Buses',
  track: ['S16' ,'S19', 'S27', 'S40', 'S41', 'S43', 'S54', 'S71', 'CO127', 'CO128', 'CO129', 'CO130', 'CO154', 'CO171', 'D897', 'D898', 'D899', 'D900', 'V1255', 'V1256'],
  routes: ['201', '301', '401', '601'],
  type: 'include',
  buses: 'exclude'
}, {
  name: 'Old Sita',
  track: ['S33', 'S64', 'S80', 'S81', 'S86', 'S91', 'S92', 'S93', 'S94', 'S95', 'S97', 'S99'],
  routes: [],
  type: 'exclude'
}, {
  name: '900 Perms off 900',
  track: ['CO116', 'CO117', 'CO118', 'CO119', 'CO120', 'CO121', 'CO146', 'CO147', 'V1309', 'V1323', 'V8227', 'V8228', 'V8229', 'V8230', 'V8231', 'V8235', 'V8239', 'V8909'],
  routes: ['900'],
  type: 'exclude'
}, {
  name: 'Non-900 Perms on 900',
  track: ['CO116', 'CO117', 'CO118', 'CO119', 'CO120', 'CO121', 'CO146', 'CO147', 'V1309', 'V1323', 'V8227', 'V8228', 'V8229', 'V8230', 'V8231', 'V8235', 'V8239', 'V8909'],
  routes: ['900'],
  type: 'include',
  buses: 'exclude'
}, {
  name: 'CDC Oakleigh Specials',
  track: ['CO7', 'CO8', 'CO11', 'CO12', 'CO13', 'CO100', 'CO103', 'CO104', 'CO105', 'CO107', 'CO108', 'CO109'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Oakleigh Hybrids',
  track: ['CO152', 'CO157', 'CO158', 'CO159', 'CO160', 'CO161', 'CO162', 'CO163'],
  routes: ['605', '630'],
  type: 'exclude'
}, {
  name: 'CDC Oakleigh Ex-Drivers',
  track: ['CO10', 'CO13', 'CO14', 'CO15', 'CO23', 'CO24', 'CO29', 'CO31', 'CO32', 'CO33', 'CO34', 'CO35', 'CO41', 'CO44', 'CO48', 'CO56', 'CO60', 'CO66', 'CO69', 'CO71', 'CO72', 'CO83', 'CO84', 'CO85', 'CO88', 'CO89', 'CO90', 'CO91'],
  routes: ['605'],
  type: 'include'
}, {
  name: 'CDC Tullamarine Specials',
  track: ['CT3', 'CT4', 'CT7', 'CT8', 'CT12', 'CT13', 'CT17', 'CT18', 'CT20'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Wyndham Specials',
  track: ['CW20', 'CW22', 'CW23', 'CW189', 'CW190'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Sunshine Specials',
  track: ['CS53', 'CS54', 'CS57', 'CS58', 'CS62'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Ballarat Specials',
  track: ['CB174', 'CB175', 'CB176'],
  routes: [],
  type: 'exclude'
}, {
  name: 'CDC Geelong Specials',
  track: [],
  routes: [],
  type: 'exclude'
}, {
  name: 'Transdev Specials',
  track: ['T574', 'T585'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Sunbury Specials',
  track: ['SB16'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Kastoria Specials',
  track: ['K13', 'K14', 'K23', 'K24', 'K25', 'K26', 'K28', 'K5001', 'K5007', 'K5026'],
  routes: [],
  type: 'exclude'
}, {
  name: 'Dysons Specials',
  track: ['D184', 'D185', 'D186', 'D430', 'D431', 'D754', 'D757', 'D758', 'D762', 'D763', 'D764'],
  routes: [],
  type: 'exclude'
}, {
  name: '509 Perms off 509',
  track: ['D895', 'D896'],
  routes: ['505', '509'],
  type: 'exclude'
}, {
  name: 'Non-509 Perms on 509',
  track: ['D895', 'D896'],
  routes: ['509'],
  type: 'include',
  buses: 'exclude'
}]
