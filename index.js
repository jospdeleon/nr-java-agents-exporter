const axios = require('axios');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

//output directory
const directory = 'output';

//config file is read in here
const configFile = fs.readFileSync('template_input.json');
const config = JSON.parse(configFile);

//read config
const starttime = moment(config.querystart,'YYYY-MM-DD');
const endtime = moment(config.queryend,'YYYY-MM-DD');

const insights_headers = {
    headers: {
        'Content-Type': 'application/json',
        'X-Query-Key': config.querykey
    }
}

//clean up the output directory and start with a fresh file
function cleanOutputDir() {
    console.log(`Current directory: ${directory}`);
    let filenames = fs.readdirSync(directory);
  
    filenames.forEach(file => {
        console.log(file);
        fs.unlinkSync(path.join(directory, file));
    });

    fs.appendFileSync(`${directory}/java-agents.csv`, `ConsumingAccountName|ApmAppName|ApmAgentVersion|Count` +  '\n');

    console.log(`Current directory cleanup done`);
}

async function getAccounts() {
    let currentstartpoint = starttime.clone();
    let querystart = "'"+currentstartpoint.format('YYYY-MM-DD HH:mm:ss')+ "'";
    let queryend = "'"+currentstartpoint.clone().add(config.slicesizeminutes, "minutes").format('YYYY-MM-DD HH:mm:ss') + "'";
    let {basequery, encodedQuery} = constructCustomQuery(config.accountquery, querystart, queryend);

    let url = 'https://insights-api.newrelic.com/v1/accounts/' + config.accountid + '/query?nrql='+encodedQuery;

    let consumingAccountNames = [];
    // Make the call to nrdb insights.   using the query string above...
    try {
        const response = await axios.get(url, insights_headers)

        // CUSTOM DATA PARSER START
        if (response.data && response.data.results[0] && response.data.results[0].members) {
            consumingAccountNames = response.data.results[0].members;
            console.log(" Number of accounts returned: " + consumingAccountNames.length);
        }
        // END DATA PARSER
        console.log(" Retrieved all accounts")
    } catch(error) {
        console.log("***** exception: " + JSON.stringify(error)  + "   *******************");
    } finally {
        return consumingAccountNames;
    }
}

async function start() {
    const start = moment();
    console.log('BEGIN: ' + start.format('YYYY-MM-DD HH:mm:ss'));
    
    cleanOutputDir();
    let consumingAccountNames = await getAccounts();

    for (const account of consumingAccountNames) {
        console.log(`Processing Account: ${account}`)
        let results = 0;

        let currentstartpoint = starttime.clone();
        let querystart = "'"+currentstartpoint.format('YYYY-MM-DD HH:mm:ss')+ "'";
        let queryend = "'"+currentstartpoint.clone().add(config.slicesizeminutes, "minutes").format('YYYY-MM-DD HH:mm:ss') + "'";
        
        let {basequery, encodedQuery} = constructCustomQuery(config.basequery, querystart, queryend, account);
        await getData(basequery, encodedQuery, currentstartpoint, querystart, queryend, results);

        console.log(`DONE Processing Account: ${account}`)
    }

    console.log("DONE Processing ALL data")
    const end = moment();
    console.log('END: ' + end.format('YYYY-MM-DD HH:mm:ss'));
    console.log(`It took ${end.diff(start, 'seconds')} seconds to complete`);
}

function constructCustomQuery(basequery, querystart, queryend, account)
{
    if (account) {
        basequery = basequery.replace(/\?/g, `'${account}'`);
    }
    var enctestpart1 = encodeURI(basequery);
    var enctestpart2 = encodeURIComponent(" SINCE " + querystart + " UNTIL " + queryend + " " + config.querysuffix);
    var final =  enctestpart1 + enctestpart2;
    var encodedQuery = final.replace(/'/g, "%27");
    console.log(`Base Query: ${basequery}`);
    // console.log(`Query: ${decodeURIComponent(enctestpart2)}`);
    console.log(" Query Time Window: "  + querystart + " ---> " +  queryend);

    return {basequery, encodedQuery};
}

async function getData(basequery, encodedstring, currentstartpoint, querystart, queryend, results) {

    var url = 'https://insights-api.newrelic.com/v1/accounts/' + config.accountid + '/query?nrql='+encodedstring;
    // Make the call to nrdb insights.   using the query string above...
    try {
        const response = await axios.get(url, insights_headers)

        // CUSTOM DATA PARSER START
        console.log(" result count returned " + response.data.facets.length);
        results += response.data.facets.length;
        for(var i = 0; i < response.data.facets.length; i++)
        {
            var datapoint = response.data.facets[i];
            var consumingAccountName = datapoint.name[0];
            var apmAppName = datapoint.name[1];
            var apmAgentVersion = datapoint.name[2];

            var count = datapoint.results[0].count

            fs.appendFileSync(`${directory}/java-agents.csv`, `${consumingAccountName}|${apmAppName}|${apmAgentVersion}|${count}` +  '\n');
        }

        // END DATA PARSER

        // if our current time point in search is still before our end time,  make recursive call
        var queryendmoment = moment(queryend, 'YYYY-MM-DD HH:mm:ss')
        if(queryendmoment.isBefore(endtime)) {
            currentstartpoint = currentstartpoint.add(config.slicesizeminutes, "minutes");  // move forward
            querystart = "'"+currentstartpoint.format('YYYY-MM-DD HH:mm:ss')+ "'";
            queryend = "'"+currentstartpoint.clone().add(config.slicesizeminutes, "minutes").format('YYYY-MM-DD HH:mm:ss') + "'";

            let {encodedQuery} = constructCustomQuery(basequery, querystart, queryend);
            await getData(basequery, encodedQuery, currentstartpoint, querystart, queryend, results)
        }
        else
        {
            console.log(" processing completed")
            console.log(" FINAL results length = " + results)
        }

    }catch(error) {
        console.log("***** exception: " + JSON.stringify(error)  + "   *******************");
        //keep track of failed store numbers
        // fs.appendFileSync(`${directory}/store-failures.csv`, `${store}` +  '\n');
    };
}

start();