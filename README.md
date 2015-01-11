Batchelor
===================
[![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/)
[![coverage status](http://img.shields.io/badge/local%20coverage-93%25-green.svg)](http://img.shields.io/badge/local%20coverage-93%25-green.svg)

Proxy utility to bundle a batch of calls in one request.
Using the batchelor utility reduces HTTP overhead, network round-trip delay time and helps to keep your API design clean.
Server side parallel request processing.
Persistent request for Web Socket facade.


### Methods
* [`configure(options)`](#configure)
* [`execute(job, callback)`](#execute)

### Methodology/Example

* [`job`](#job)
* [`request`](#request)
* [`Examples`](#Examples)


<a name="configure" />
## configure(options)
configure the batchelor object.

* maxConcurrentJobs - integer containing the number of maximum concurrent jobs (default:50)
* logger - object for logging porpouse (default: console).
* whiteList - an array containing a list of allow host for processing the request (default: *, meaning allow all host/urls).
* request_default_values - Object containing the default values per request in case they are not passed
* method - string containing default HTTP method for the request - Possible values "GET" or "POST"
* timeout - integer containing the number of milliseconds to wait for a request to respond before aborting the request (default: 1000).
* ip - string of the client that request the batching job. (default: "unknown").
* headers {} - object containing the headers of the client that request the batching job
* body - string that will be pass in case of POST request


#### options  example:
```json
{
    maxConcurrentJobs: 10,
    logger: "console",
    request_default_values: {
        method: "GET",
        timeout: 10000,
        ip: "unknown",
        headers: {},
        body: ""
    },
    whiteList: ["*"]
}
```

<a name="execute" />
## execute(job, callback)

* `job` - A single request object or array of single requests [required]
* `callback(err, results)` - callback method when finish processimg request/s [required]
- The callback argument gets 2 arguments:
- err - error object, if an error occur, null otherwise
- results - an JSON object conatining the result/s of the request/s

<a name="job" />
## job
An object holding single or array of items, to be batch in the request

<a name="request" />
## request
An object representing a single batch of request. The item must have the following

* `name` - identifier of the item, the name is used as reference. Names must be UNIQUE! [required]
* `url` - URL that calls the item. Possible GET parameters are also given here [required]
* `method` - possible values are `GET` or `POST` or whatever methods the called API supports [required]
* `encoding` - the encoding of the item (default:UTF8) [optional]
* `retries` - number of retries if the timeout is reach (default:2) [optional]
* `headers` - the headers that the item uses [optional]
* `body` - the parameters that the item uses when the method is POST are given here [optional]
* `timeout` - number of milliseconds to wait for a request from the API to respond before aborting the request, if this parameters is not provided we use timeout from the config.json file [optional]
* `isOnCloseRequest` - flag indicating if the item should be called when the connection is droped (default:false) [optional]
* `persistent` - flag indicating if the item should be called in persistent way(default:false) [optional]
* `persistentDelay` - number of delay between persistent items in milliseconds (default:5000) [optional]


<a name="Examples" />
## Examples

## REST using ExpressJS Version 4.5.0
```javascript
var exp_app = express();
var compression = require('compression');
var bodyParser = require('body-parser');
var exp_router = express.Router();
exp_app.use(compression());
exp_app.use(bodyParser());
var batchelor = require('batchelor');
var configuration = {
  logger: console,
  maxWorkersPerJob: 10,
  persistentDelay: 2000,
  repeatConcurrency: 5,
  timeout: 5000,
  whiteList: ["github.com", "hotmail.net"]
};


batchelor.configure(configuration);
exp_router.post('/', function (req, res, next) {
    batchelor.execute(req.body, function (err, results) {
        if (err) {
            console.log("Error occur");
        }
        else {
            res.send(JSON.stringify(results));
        }
    });
});

exp_app.use('/', exp_router);
exp_app.listen(5050);
```
## WebSocket
```javascript
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 5050});
var batchelor = require('batchelor');
var configuration = {
  logger: console,
  maxWorkersPerJob: 10,
  persistentDelay: 2000,
  repeatConcurrency: 5,
  timeout: 5000,
  useTooBusy: true,
  whiteList: ["github.com", "hotmail.net"]
};

batchelor.persistent.configure(configuration);
ws.on('message', function (data) {
    batchelor.persistent.execute(data,
        function (err, results) {
            ws.send(JSON.stringify(results));
        });
});
```
## Request - Using WebSocket facade
```javascript
var job = [
    {
        name: "item1",
        url: "https://www.domain.com/item/1"
        method: "GET",
        retries: 2,
        timeout:5000
    },
    {
        name: "item2",
        url: "https://www.domain.com/item/2"
        method: "POST",
        retries: 5,
        headers: {
            Authorization: "secret 123654789"
        },
        timeout:5000
    }
];
var ws = new WebSocket("wss://yourdomain/path");
ws.onopen = function () {
    document.getElementById("connectionStatus").innerHTML = "Connected";
};
ws.onmessage = function (event) {
    document.getElementById("responseFromServer").value = event.data;
};
```

## Response from previoius request
```json
    {
        item1:{
            body: {name: "myname1", id: 1},
            statusCode: 200,
            headers: {"content-type":"application/json"}
        },
        item2:{
            body: {name: "myname2", id: 2},
            statusCode: 200,
            headers: {"content-type":"application/json"}
        }
    }
```
