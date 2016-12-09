'use strict';


//var APP_SERVER = 'http://verizonmdm-dev1.vzwcorp.com'; //Dev2
//var APP_SERVER = 'http://sclmdm02wqa.sdc.vzwcorp.com:6003'; //QA2
var APP_SERVER = 'http://10.69.86.17:9082';

var GW_SERVER = 'http://verizonmdm-dev2.vzwcorp.com';

var express = require('express');
var expressProxy = require('express-http-proxy');
var bodyParser = require('body-parser');
var mkdirp = require('mkdirp');
var app = express();
var fs = require('fs');
var url = require('url');
var server;
var CAPTURE_JSON = false;
// parse application/json
if(CAPTURE_JSON) {
  app.use(bodyParser.json());
  app.use(function(req, res, next){
    req.__body = req.body;
    req.body = new Buffer(JSON.stringify(req.body));
    next();
  });
}

app.use('/UI/ws/switchServices/getAuthenticatedEmmUrl', function(req, res, next){
  setTimeout(next, 2* 60 *1000);
});

app.use('/UI/data/', function(req, res) {
  var options = {
    root: __dirname + '/../webapp/data',
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  };

  res.sendFile(req.url.replace(/^\//, ''), options, function(err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    }
  });
});

app.use('/UI/ws/adminServices/getNewUserRoleNPermissions', function(req, res){
  // res.status(501).json({
  //   statusCode: '501',
  //   statusMessage: 'No Verizon Services have been purchased. You can purchase valid VerizonMDM services from “VZ Business Portal"'
  // });
  // res.json({
  //   statusCode: '200',
  //   statusMessage: 'success',
  //   data: {
  //     firstName: 'Ajay',
  //     lastName: 'Kumar',
  //     userId: 'akumar',
  //     ecpdId: '2807869',
  //     contractId: '2173821',
  //     userRole: 'Admin'
  //   }
  // });
  res.json({
    statusCode: '200',
    statusMessage: 'success',
    data: {
      userRole: 'admin',
      permissions: [
        '5'
      ]
    }
  });
});

function writeResponseIntoFile(rsp, data, req){
  var dirPath = './jsons';
  var fileName;
  var api;
  var cmd;

  function getDirectoryPath(path){
    var splits;
    path = path.replace('/mvdProxy/callRDD?api=', '');
    splits = path.split('/');
    return splits.slice(0, splits.length - 1).join('/');
  }

  function clone(a) {
    return JSON.parse(JSON.stringify(a));
  }

  function getFileName(path){
    var splits = path.split('/');
    var name = splits[splits.length - 1];
    var reqData = req.__body;
    var pathname;
    var dataCopy = {};

    if(/\/mvdProxy\/callRDD\?api=/.test(req.url)) {
      api = req.url.replace('/mvdProxy/callRDD?api=', '').replace(/^\//, '');
      cmd = url.parse(api).query;
      pathname = url.parse(api).pathname;
      splits = pathname.split('/');
      cmd = cmd.replace(/json=/, '');
      try {
        cmd = JSON.parse(decodeURIComponent(cmd));
      } catch(e){
        cmd = {};
      }
      api = api.replace(/\?json=.+/, '');
      return splits[splits.length - 1] + serialize(cmd).replace(/time_\d+_/, '');
    }

    function isEmptyObject(obj) {
      return !Object.keys(obj).length;
    }

    if(!isEmptyObject(reqData)) {
      cmd = '';
      if(reqData.data) {
        dataCopy = clone(reqData);
        delete dataCopy.data;
        delete dataCopy.filters;
        cmd = serialize(dataCopy);
        cmd = cmd + '_data_' + serialize(reqData.data);
      }else {
        delete reqData.filters;
        cmd = serialize(reqData);
      }
      name = name + '-' + cmd;
    }
    name = name;
    return name.replace(/^\//, '');
  }

  function serialize(obj) {
    var str = [];
    var p;
    for(p in obj) {
      if (obj.hasOwnProperty(p) && typeof obj[p] !== 'undefined') {
        str.push(encodeURIComponent(p) + '_' + encodeURIComponent(obj[p]));
      }
    }
    return str.join('_').replace(/%20/g, '-');
  }

  dirPath = dirPath + getDirectoryPath(req.url);
  fileName = getFileName(req.url);
  fileName = fileName.substring(0, 200);
  fileName = fileName + '.json';

  mkdirp(dirPath, function (err) {
    if (err)  {
      console.error(err);
    } else {
      if(fileName) {
        console.info('Creating file ' + dirPath + '/' + fileName);
        fs.writeFile(dirPath + '/' + fileName, data.toString('utf8'), function(e){
          if(e) {
            console.log(e);
            return;
          }
          console.log('file created');
        });
      }
    }
  });
}

app.use('/UI', express.static('../webapp'));
app.use(express.static('../webapp'));

app.use('/UI/ws/', expressProxy(APP_SERVER, {
  forwardPath: function(req) {
    return '/UI/ws/' + require('url').parse(req.url).path;
  },
  decorateRequest: function(reqOpt){
    reqOpt.headers['Am_ecpd_id'] = 2807869;
    // reqOpt.headers['Host'] = 'vzw.com';
    // reqOpt.headers['Am_uid'] = 'MDMQAREAD';
    // reqOpt.headers['Am_mb_role'] = '[{"portal":"VZW","roles":["Admin"]}]';
    // reqOpt.headers['Am_first_name'] = 'MDMSDCQA';
    // reqOpt.headers['Am_last_name'] = 'MDMSDCQA';
    return reqOpt;
  },
  intercept: function(rsp, data, req, res, callback) {

    if(CAPTURE_JSON) {
      writeResponseIntoFile(rsp, data, req, res, callback);
    }
    try {
      data = JSON.parse(data.toString('utf8'));
      callback(null, JSON.stringify(data));
    } catch(e) {
      callback(null, data.toString('utf8'));
    }
  }
}));

app.use('/MDMGW/', expressProxy(GW_SERVER, {
  forwardPath: function(req) {
    return '/MDMGW' + require('url').parse(req.url).path;
  },
  decorateRequest: function(reqOpt){
    reqOpt.headers['Am_ecpd_id'] = 2807869;
    return reqOpt;
  },
  intercept: function(rsp, data, req, res, callback) {
    // rsp - original response from the target
    try {
      data = JSON.parse(data.toString('utf8'));
      callback(null, JSON.stringify(data));
    } catch(e) {
      callback(null, data.toString('utf8'));
    }
  }
}));

app.use('/emm/', expressProxy('https://verizonmdm-dev2.vzw.com', {
  forwardPath: function(req) {
    return '/emm' + require('url').parse(req.url).path;
  },
  intercept: function(rsp, data, req, res, callback) {
    // rsp - original response from the target
    try {
        callback(null, JSON.stringify(data));
    } catch(e) {
      callback(null, data.toString('utf8'));
    }
  }
}));

app.post('*', function(req, res) {
  var items = [{
    'status': '200',
    'message': 'Data saved successfully',
    'trxId': 'mwapi-1455295607171-900'
  }, {
    'status': '500',
    'message': 'Could not save data',
    'trxId': 'mwapi-1455295607171-586'
  }];
  var item = items[Math.floor(Math.random() * items.length)];
  setTimeout(function() {
    res.json(item);
  }, 2000);
});

server = app.listen(8000, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('App listening at http://%s:%s', host, port);
});



// ECPDIDs
// [
//   {
//     "ecpdName": "GERSHMAN BRICKNER BRATTON INC - 1921590",
//     "ecpdId": "2438117"
//   },
//   {
//     "ecpdName": "DMVHUB, INC M2M - 2275837",
//     "ecpdId": "3010825"
//   },
//   {
//     "ecpdName": "BNSF 2560100 EUC - 150784",
//     "ecpdId": "2560100"
//   },
//   {
//     "ecpdName": "ALARM COM VSP STANDARD CPN VTS - 2138425",
//     "ecpdId": "3117986"
//   },
//   {
//     "ecpdName": "LIFESPAN CORPORATION - 2422937",
//     "ecpdId": "765587"
//   },
//   {
//     "ecpdName": "PAUL HASTINGS LLP - 2512242",
//     "ecpdId": "777498"
//   },
//   {
//     "ecpdName": "DEFG CORP70 - 56537",
//     "ecpdId": "84174"
//   },
//   {
//     "ecpdName": "BANK OF HAWAII - 2405234",
//     "ecpdId": "3103952"
//   },
//   {
//     "ecpdName": "DEFG CORP67 - 71464-1913539",
//     "ecpdId": "71464"
//   },
//   {
//     "ecpdName": "COBB ELECTRICAL MEMMBERSHIP CORPORATION - 2142110",
//     "ecpdId": "93426"
//   },
//   {
//     "ecpdName": "HIJK CORP155 - 527064",
//     "ecpdId": "2480952"
//   },
//   {
//     "ecpdName": "TOTAL APPLIANCE AND AIR CONDITIONING (NPP CONST) - 3212812-348603",
//     "ecpdId": "3212812"
//   },
//   {
//     "ecpdName": "UNITED STATES POSTAL SERVICE - 5856-1219",
//     "ecpdId": "5856"
//   },
//   {
//     "ecpdName": "FRED ENSTROM - 2339",
//     "ecpdId": "7538"
//   },
//   {
//     "ecpdName": "CHR HANSEN - CORP - 812",
//     "ecpdId": "3513"
//   },
//   {
//     "ecpdName": "CHA CONSULTING INC (NPP CONST) - 2404-348603",
//     "ecpdId": "2404"
//   },
//   {
//     "ecpdName": "WEST MYBIZ TEST ACCT - PINK - 183607",
//     "ecpdId": "583582"
//   },
//   {
//     "ecpdName": "EVERYTHING WIRELESS (CA) - MY BIZ - 2433512",
//     "ecpdId": "937248"
//   },
//   {
//     "ecpdName": "JARRETT ENTERPRISES INC VSP BASIC SH1 - 2127861",
//     "ecpdId": "2788646"
//   },
//   {
//     "ecpdName": "SUPER DISCOUNT DRUGS - 4730",
//     "ecpdId": "10233"
//   },
//   {
//     "ecpdName": "RSTU CORP104 - 0",
//     "ecpdId": "615750"
//   },
//   {
//     "ecpdName": "CITIGROUP DIRECT BILLING - 73982",
//     "ecpdId": "757350"
//   },
//   {
//     "ecpdName": "BEST BUY EXECUTIVES - 474360",
//     "ecpdId": "909204"
//   },
//   {
//     "ecpdName": "VZW - HQ TEST LINES - 2173821",
//     "ecpdId": "2807869"
//   },
//   {
//     "ecpdName": "WESTERN REFINING CO-CORP M2M SH1 - 61455",
//     "ecpdId": "2861833"
//   },
//   {
//     "ecpdName": "BIMBO BAKERIES USA INC PA - 2498620",
//     "ecpdId": "8031"
//   },
//   {
//     "ecpdName": "LIFEWATCH VSP M2M CUSTOM - 2426861",
//     "ecpdId": "2762449"
//   },
//   {
//     "ecpdName": "WEST MYBIZ TEST ACCT - BLUE - 182790",
//     "ecpdId": "582760"
//   },
//   {
//     "ecpdName": "VENTUS NETWORKS M2M 1GB VSP PLUS - 2135816",
//     "ecpdId": "2803887"
//   },
//   {
//     "ecpdName": "YUM BRANDS FRANCHISE: FULENWIDER ENTERPRISES KFC - 334102",
//     "ecpdId": "42814"
//   },
//   {
//     "ecpdName": "SOBERLINK CUSTOM 2MB M2M (VSP) (CPN) - 2249771",
//     "ecpdId": "3520144"
//   },
//   {
//     "ecpdName": "ACCELRYS SOFTWARE INC - 0",
//     "ecpdId": "6385"
//   },
//   {
//     "ecpdName": "CONAM MANAGEMENT (NPP RE) - 7126-2363594",
//     "ecpdId": "7126"
//   },
//   {
//     "ecpdName": "WEST MYBIZ TEST - GOOFY - 183604",
//     "ecpdId": "786284"
//   },
//   {
//     "ecpdName": "FEDERATED RURAL ELECTRIC INSURANCE EXC (NPP F&I) - 114579-2353087",
//     "ecpdId": "114579"
//   },
//   {
//     "ecpdName": "CITY OIL CO INC - 469042",
//     "ecpdId": "902047"
//   },
//   {
//     "ecpdName": "NOSSAMAN LLP (NPP LEGAL) - 14880-515675",
//     "ecpdId": "14880"
//   },
//   {
//     "ecpdName": "CARPENTER CO - 6059",
//     "ecpdId": "12321"
//   },
//   {
//     "ecpdName": "HY-VEE INC - 33577",
//     "ecpdId": "46081"
//   },
//   {
//     "ecpdName": "RAFFERTY ALUMINUM & STEEL CO INC - 1567970",
//     "ecpdId": "2059713"
//   },
//   {
//     "ecpdName": "VERIZON WIRELESS - CTC LAB 1 - 144368",
//     "ecpdId": "2456788"
//   }
// ]
