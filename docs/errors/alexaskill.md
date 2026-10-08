2026-10-08T06:53:45.183Z
{
    "time": "2026-10-08T06:53:45.183Z",
    "type": "platform.initStart",
    "record": {
        "initializationType": "on-demand",
        "phase": "init",
        "runtimeVersion": "nodejs:22.mainline.v122",
        "runtimeVersionArn": "arn:aws:lambda:eu-west-1::runtime:775dab0d220a0b97f3ec34fe1692d7a07b5d13049153b00f03204c9543bd69e4",
        "functionName": "tenner-alexa-skill",
        "functionVersion": "$LATEST",
        "instanceId": "2026/10/08/tenner-alexa-skill[$LATEST]829a781a0b594522bd016a7faa31f35e",
        "instanceMaxMemory": 268435456
    }
}

{"time":"2026-10-08T06:53:45.183Z","type":"platform.initStart","record":{"initializationType":"on-demand","phase":"init","runtimeVersion":"nodejs:22.mainline.v122","runtimeVersionArn":"arn:aws:lambda:eu-west-1::runtime:775dab0d220a0b97f3ec34fe1692d7a07b5d13049153b00f03204c9543bd69e4","functionName":"tenner-alexa-skill","functionVersion":"$LATEST","instanceId":"2026/10/08/tenner-alexa-skill[$LATEST]829a781a0b594522bd016a7faa31f35e","instanceMaxMemory":268435456}}
2026-10-08T06:53:45.332Z
{
    "time": "2026-10-08T06:53:45.332Z",
    "type": "platform.start",
    "record": {
        "requestId": "a45d720c-3e8e-4748-b9c1-56ab2ea95229",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:53:45.332Z","type":"platform.start","record":{"requestId":"a45d720c-3e8e-4748-b9c1-56ab2ea95229","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:53:49.235Z
{
    "timestamp": "2026-10-08T06:53:49.235Z",
    "level": "INFO",
    "requestId": "a45d720c-3e8e-4748-b9c1-56ab2ea95229",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.8b00d680-aca1-4d9b-8f10-1dd44f965326\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":3900,\"apiCalls\":3,\"apiMs\":2951,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:53:49.235Z","level":"INFO","requestId":"a45d720c-3e8e-4748-b9c1-56ab2ea95229","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.8b00d680-aca1-4d9b-8f10-1dd44f965326\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":3900,\"apiCalls\":3,\"apiMs\":2951,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:53:49.256Z
{
    "time": "2026-10-08T06:53:49.256Z",
    "type": "platform.report",
    "record": {
        "requestId": "a45d720c-3e8e-4748-b9c1-56ab2ea95229",
        "metrics": {
            "durationMs": 3923.569,
            "billedDurationMs": 4069,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 118,
            "initDurationMs": 145.399
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:53:49.256Z","type":"platform.report","record":{"requestId":"a45d720c-3e8e-4748-b9c1-56ab2ea95229","metrics":{"durationMs":3923.569,"billedDurationMs":4069,"memorySizeMB":256,"maxMemoryUsedMB":118,"initDurationMs":145.399},"status":"success"}}
2026-10-08T06:53:49.280Z
{
    "time": "2026-10-08T06:53:49.280Z",
    "type": "platform.start",
    "record": {
        "requestId": "43a951b3-6893-4460-88d7-7e1987d69c89",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:53:49.280Z","type":"platform.start","record":{"requestId":"43a951b3-6893-4460-88d7-7e1987d69c89","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:53:49.281Z
{
    "timestamp": "2026-10-08T06:53:49.281Z",
    "level": "INFO",
    "requestId": "43a951b3-6893-4460-88d7-7e1987d69c89",
    "message": "{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.80e1e5e7-c934-4401-8398-7cbba57e64cd\",\"requestType\":\"System.ExceptionEncountered\"}"
}

{"timestamp":"2026-10-08T06:53:49.281Z","level":"INFO","requestId":"43a951b3-6893-4460-88d7-7e1987d69c89","message":"{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.80e1e5e7-c934-4401-8398-7cbba57e64cd\",\"requestType\":\"System.ExceptionEncountered\"}"}
2026-10-08T06:53:49.281Z
{
    "timestamp": "2026-10-08T06:53:49.281Z",
    "level": "INFO",
    "requestId": "43a951b3-6893-4460-88d7-7e1987d69c89",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.80e1e5e7-c934-4401-8398-7cbba57e64cd\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:53:49.281Z","level":"INFO","requestId":"43a951b3-6893-4460-88d7-7e1987d69c89","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.80e1e5e7-c934-4401-8398-7cbba57e64cd\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:53:49.283Z
{
    "time": "2026-10-08T06:53:49.283Z",
    "type": "platform.report",
    "record": {
        "requestId": "43a951b3-6893-4460-88d7-7e1987d69c89",
        "metrics": {
            "durationMs": 2.761,
            "billedDurationMs": 3,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 118
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:53:49.283Z","type":"platform.report","record":{"requestId":"43a951b3-6893-4460-88d7-7e1987d69c89","metrics":{"durationMs":2.761,"billedDurationMs":3,"memorySizeMB":256,"maxMemoryUsedMB":118},"status":"success"}}
2026-10-08T06:53:52.407Z
{
    "time": "2026-10-08T06:53:52.407Z",
    "type": "platform.start",
    "record": {
        "requestId": "0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:53:52.407Z","type":"platform.start","record":{"requestId":"0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:53:52.412Z
{
    "timestamp": "2026-10-08T06:53:52.412Z",
    "level": "INFO",
    "requestId": "0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5",
    "message": "{\"level\":\"info\",\"event\":\"widget_lifecycle\",\"requestId\":\"amzn1.echo-api.request.e4204da2-c7d6-4c92-a52f-16b156e112c6\",\"requestType\":\"Alexa.DataStore.PackageManager.UsagesRemoved\"}"
}

{"timestamp":"2026-10-08T06:53:52.412Z","level":"INFO","requestId":"0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5","message":"{\"level\":\"info\",\"event\":\"widget_lifecycle\",\"requestId\":\"amzn1.echo-api.request.e4204da2-c7d6-4c92-a52f-16b156e112c6\",\"requestType\":\"Alexa.DataStore.PackageManager.UsagesRemoved\"}"}
2026-10-08T06:53:52.412Z
{
    "timestamp": "2026-10-08T06:53:52.412Z",
    "level": "INFO",
    "requestId": "0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.e4204da2-c7d6-4c92-a52f-16b156e112c6\",\"requestType\":\"Alexa.DataStore.PackageManager.UsagesRemoved\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:53:52.412Z","level":"INFO","requestId":"0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.e4204da2-c7d6-4c92-a52f-16b156e112c6\",\"requestType\":\"Alexa.DataStore.PackageManager.UsagesRemoved\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:53:52.415Z
{
    "time": "2026-10-08T06:53:52.415Z",
    "type": "platform.report",
    "record": {
        "requestId": "0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5",
        "metrics": {
            "durationMs": 6.848,
            "billedDurationMs": 7,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 118
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:53:52.415Z","type":"platform.report","record":{"requestId":"0a5a243f-379a-4dad-b7b1-97ea2a0b2ce5","metrics":{"durationMs":6.848,"billedDurationMs":7,"memorySizeMB":256,"maxMemoryUsedMB":118},"status":"success"}}
2026-10-08T06:54:01.044Z
{
    "time": "2026-10-08T06:54:01.044Z",
    "type": "platform.start",
    "record": {
        "requestId": "540e9134-6d86-4145-81d7-df2d7a99c442",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:54:01.044Z","type":"platform.start","record":{"requestId":"540e9134-6d86-4145-81d7-df2d7a99c442","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:54:01.477Z
{
    "timestamp": "2026-10-08T06:54:01.477Z",
    "level": "INFO",
    "requestId": "540e9134-6d86-4145-81d7-df2d7a99c442",
    "message": "{\"level\":\"info\",\"event\":\"widget_installed\",\"requestId\":\"amzn1.echo-api.request.ca691189-ac2c-427e-8ad6-060de8294caa\"}"
}

{"timestamp":"2026-10-08T06:54:01.477Z","level":"INFO","requestId":"540e9134-6d86-4145-81d7-df2d7a99c442","message":"{\"level\":\"info\",\"event\":\"widget_installed\",\"requestId\":\"amzn1.echo-api.request.ca691189-ac2c-427e-8ad6-060de8294caa\"}"}
2026-10-08T06:54:01.477Z
{
    "timestamp": "2026-10-08T06:54:01.477Z",
    "level": "INFO",
    "requestId": "540e9134-6d86-4145-81d7-df2d7a99c442",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.ca691189-ac2c-427e-8ad6-060de8294caa\",\"requestType\":\"Alexa.DataStore.PackageManager.UsagesInstalled\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":432,\"apiCalls\":1,\"apiMs\":430,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:54:01.477Z","level":"INFO","requestId":"540e9134-6d86-4145-81d7-df2d7a99c442","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.ca691189-ac2c-427e-8ad6-060de8294caa\",\"requestType\":\"Alexa.DataStore.PackageManager.UsagesInstalled\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":432,\"apiCalls\":1,\"apiMs\":430,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:54:01.479Z
{
    "time": "2026-10-08T06:54:01.479Z",
    "type": "platform.report",
    "record": {
        "requestId": "540e9134-6d86-4145-81d7-df2d7a99c442",
        "metrics": {
            "durationMs": 434.702,
            "billedDurationMs": 435,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 120
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:54:01.479Z","type":"platform.report","record":{"requestId":"540e9134-6d86-4145-81d7-df2d7a99c442","metrics":{"durationMs":434.702,"billedDurationMs":435,"memorySizeMB":256,"maxMemoryUsedMB":120},"status":"success"}}
2026-10-08T06:54:13.193Z
{
    "time": "2026-10-08T06:54:13.193Z",
    "type": "platform.start",
    "record": {
        "requestId": "7cda9840-c29a-4e1d-a0d3-00eea36fdf08",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:54:13.193Z","type":"platform.start","record":{"requestId":"7cda9840-c29a-4e1d-a0d3-00eea36fdf08","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:54:13.939Z
{
    "timestamp": "2026-10-08T06:54:13.939Z",
    "level": "INFO",
    "requestId": "7cda9840-c29a-4e1d-a0d3-00eea36fdf08",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.554a106e-8401-45f6-b1a8-32e3ab904f60\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":745,\"apiCalls\":3,\"apiMs\":722,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:54:13.939Z","level":"INFO","requestId":"7cda9840-c29a-4e1d-a0d3-00eea36fdf08","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.554a106e-8401-45f6-b1a8-32e3ab904f60\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":745,\"apiCalls\":3,\"apiMs\":722,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:54:13.955Z
{
    "time": "2026-10-08T06:54:13.955Z",
    "type": "platform.report",
    "record": {
        "requestId": "7cda9840-c29a-4e1d-a0d3-00eea36fdf08",
        "metrics": {
            "durationMs": 761.412,
            "billedDurationMs": 762,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 120
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:54:13.955Z","type":"platform.report","record":{"requestId":"7cda9840-c29a-4e1d-a0d3-00eea36fdf08","metrics":{"durationMs":761.412,"billedDurationMs":762,"memorySizeMB":256,"maxMemoryUsedMB":120},"status":"success"}}
2026-10-08T06:54:13.967Z
{
    "timestamp": "2026-10-08T06:54:13.967Z",
    "level": "INFO",
    "requestId": "d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9",
    "message": "{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.614bbe73-8b46-4cdd-b1ff-e2ae9e43ebab\",\"requestType\":\"System.ExceptionEncountered\"}"
}

{"timestamp":"2026-10-08T06:54:13.967Z","level":"INFO","requestId":"d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9","message":"{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.614bbe73-8b46-4cdd-b1ff-e2ae9e43ebab\",\"requestType\":\"System.ExceptionEncountered\"}"}
2026-10-08T06:54:13.967Z
{
    "time": "2026-10-08T06:54:13.967Z",
    "type": "platform.start",
    "record": {
        "requestId": "d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:54:13.967Z","type":"platform.start","record":{"requestId":"d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:54:13.968Z
{
    "timestamp": "2026-10-08T06:54:13.968Z",
    "level": "INFO",
    "requestId": "d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.614bbe73-8b46-4cdd-b1ff-e2ae9e43ebab\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":1,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:54:13.968Z","level":"INFO","requestId":"d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.614bbe73-8b46-4cdd-b1ff-e2ae9e43ebab\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":1,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:54:13.975Z
{
    "time": "2026-10-08T06:54:13.975Z",
    "type": "platform.report",
    "record": {
        "requestId": "d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9",
        "metrics": {
            "durationMs": 7.199,
            "billedDurationMs": 8,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 120
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:54:13.975Z","type":"platform.report","record":{"requestId":"d3afa5cf-e91e-4d99-bdf2-d3b84f833fa9","metrics":{"durationMs":7.199,"billedDurationMs":8,"memorySizeMB":256,"maxMemoryUsedMB":120},"status":"success"}}
2026-10-08T06:56:10.312Z
{
    "time": "2026-10-08T06:56:10.312Z",
    "type": "platform.start",
    "record": {
        "requestId": "19f97505-5f2d-482e-ab22-3c6ad42996db",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:56:10.312Z","type":"platform.start","record":{"requestId":"19f97505-5f2d-482e-ab22-3c6ad42996db","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:56:11.476Z
{
    "timestamp": "2026-10-08T06:56:11.476Z",
    "level": "INFO",
    "requestId": "19f97505-5f2d-482e-ab22-3c6ad42996db",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.5e5ffff6-f2ae-4fce-863c-7acd6d428bbf\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":1061,\"apiCalls\":3,\"apiMs\":1039,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:56:11.476Z","level":"INFO","requestId":"19f97505-5f2d-482e-ab22-3c6ad42996db","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.5e5ffff6-f2ae-4fce-863c-7acd6d428bbf\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":1061,\"apiCalls\":3,\"apiMs\":1039,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:56:11.479Z
{
    "time": "2026-10-08T06:56:11.479Z",
    "type": "platform.report",
    "record": {
        "requestId": "19f97505-5f2d-482e-ab22-3c6ad42996db",
        "metrics": {
            "durationMs": 1166.368,
            "billedDurationMs": 1167,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 121
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:56:11.479Z","type":"platform.report","record":{"requestId":"19f97505-5f2d-482e-ab22-3c6ad42996db","metrics":{"durationMs":1166.368,"billedDurationMs":1167,"memorySizeMB":256,"maxMemoryUsedMB":121},"status":"success"}}
2026-10-08T06:56:11.511Z
{
    "time": "2026-10-08T06:56:11.511Z",
    "type": "platform.start",
    "record": {
        "requestId": "a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:56:11.511Z","type":"platform.start","record":{"requestId":"a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:56:11.512Z
{
    "timestamp": "2026-10-08T06:56:11.512Z",
    "level": "INFO",
    "requestId": "a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e",
    "message": "{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.3d84174e-606d-4369-8b39-923463aac3c0\",\"requestType\":\"System.ExceptionEncountered\"}"
}

{"timestamp":"2026-10-08T06:56:11.512Z","level":"INFO","requestId":"a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e","message":"{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.3d84174e-606d-4369-8b39-923463aac3c0\",\"requestType\":\"System.ExceptionEncountered\"}"}
2026-10-08T06:56:11.512Z
{
    "timestamp": "2026-10-08T06:56:11.512Z",
    "level": "INFO",
    "requestId": "a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.3d84174e-606d-4369-8b39-923463aac3c0\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:56:11.512Z","level":"INFO","requestId":"a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.3d84174e-606d-4369-8b39-923463aac3c0\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:56:11.514Z
{
    "time": "2026-10-08T06:56:11.514Z",
    "type": "platform.report",
    "record": {
        "requestId": "a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e",
        "metrics": {
            "durationMs": 1.943,
            "billedDurationMs": 2,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 121
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:56:11.514Z","type":"platform.report","record":{"requestId":"a2fd7dd0-ae6c-4b4c-bbed-4755bf4dfe0e","metrics":{"durationMs":1.943,"billedDurationMs":2,"memorySizeMB":256,"maxMemoryUsedMB":121},"status":"success"}}
2026-10-08T06:57:23.294Z
{
    "time": "2026-10-08T06:57:23.294Z",
    "type": "platform.start",
    "record": {
        "requestId": "e2b68d9e-5ba7-46ae-b38e-b16b10cdabd1",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:57:23.294Z","type":"platform.start","record":{"requestId":"e2b68d9e-5ba7-46ae-b38e-b16b10cdabd1","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:57:24.176Z
{
    "timestamp": "2026-10-08T06:57:24.176Z",
    "level": "INFO",
    "requestId": "e2b68d9e-5ba7-46ae-b38e-b16b10cdabd1",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.b0994032-f2a1-4a74-8586-eec7fad1bddb\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":879,\"apiCalls\":3,\"apiMs\":855,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:57:24.176Z","level":"INFO","requestId":"e2b68d9e-5ba7-46ae-b38e-b16b10cdabd1","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.b0994032-f2a1-4a74-8586-eec7fad1bddb\",\"requestType\":\"Alexa.Presentation.APL.UserEvent\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":879,\"apiCalls\":3,\"apiMs\":855,\"apiStatus\":200,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:57:24.197Z
{
    "time": "2026-10-08T06:57:24.197Z",
    "type": "platform.report",
    "record": {
        "requestId": "e2b68d9e-5ba7-46ae-b38e-b16b10cdabd1",
        "metrics": {
            "durationMs": 902.498,
            "billedDurationMs": 903,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 121
        },
        "status": "success"
    }
}

{"time":"2026-10-08T06:57:24.197Z","type":"platform.report","record":{"requestId":"e2b68d9e-5ba7-46ae-b38e-b16b10cdabd1","metrics":{"durationMs":902.498,"billedDurationMs":903,"memorySizeMB":256,"maxMemoryUsedMB":121},"status":"success"}}
2026-10-08T06:57:24.215Z
{
    "time": "2026-10-08T06:57:24.215Z",
    "type": "platform.start",
    "record": {
        "requestId": "cc84ec2c-029f-44fe-af3e-6cc996263135",
        "functionArn": "arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill",
        "version": "$LATEST"
    }
}

{"time":"2026-10-08T06:57:24.215Z","type":"platform.start","record":{"requestId":"cc84ec2c-029f-44fe-af3e-6cc996263135","functionArn":"arn:aws:lambda:eu-west-1:825765399535:function:tenner-alexa-skill","version":"$LATEST"}}
2026-10-08T06:57:24.216Z
{
    "timestamp": "2026-10-08T06:57:24.216Z",
    "level": "INFO",
    "requestId": "cc84ec2c-029f-44fe-af3e-6cc996263135",
    "message": "{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.8ab3b9b0-38c4-4c90-be18-009c06a75bde\",\"requestType\":\"System.ExceptionEncountered\"}"
}

{"timestamp":"2026-10-08T06:57:24.216Z","level":"INFO","requestId":"cc84ec2c-029f-44fe-af3e-6cc996263135","message":"{\"level\":\"info\",\"event\":\"unhandled_request\",\"requestId\":\"amzn1.echo-api.request.8ab3b9b0-38c4-4c90-be18-009c06a75bde\",\"requestType\":\"System.ExceptionEncountered\"}"}
2026-10-08T06:57:24.216Z
{
    "timestamp": "2026-10-08T06:57:24.216Z",
    "level": "INFO",
    "requestId": "cc84ec2c-029f-44fe-af3e-6cc996263135",
    "message": "{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.8ab3b9b0-38c4-4c90-be18-009c06a75bde\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"
}

{"timestamp":"2026-10-08T06:57:24.216Z","level":"INFO","requestId":"cc84ec2c-029f-44fe-af3e-6cc996263135","message":"{\"level\":\"info\",\"event\":\"skill_request\",\"requestId\":\"amzn1.echo-api.request.8ab3b9b0-38c4-4c90-be18-009c06a75bde\",\"requestType\":\"System.ExceptionEncountered\",\"locale\":\"de-DE\",\"device\":\"HUB-LANDSCAPE-LARGE\",\"durationMs\":0,\"apiCalls\":0,\"outcome\":\"ANSWERED\"}"}
2026-10-08T06:57:24.218Z
{
    "time": "2026-10-08T06:57:24.218Z",
    "type": "platform.report",
    "record": {
        "requestId": "cc84ec2c-029f-44fe-af3e-6cc996263135",
        "metrics": {
            "durationMs": 2.208,
            "billedDurationMs": 3,
            "memorySizeMB": 256,
            "maxMemoryUsedMB": 121
        },
        "status": "success"
    }
}
