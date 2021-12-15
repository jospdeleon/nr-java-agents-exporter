# nr-java-agents-exporter

>This is inspired by [nr1-nrdb-miner](https://github.com/newrelic-experimental/nr1-nrdb-miner) which has been customized to extract all applications across accounts that are using the New Relic Java Agent. It's a nodejs cli application which uses the New Relic Insights Query API to query NRDB by issuing the same query over a series of date ranges and sub-accounts.

## Installation

> From root directory, `npm install` to install node modules.  

## Getting Started
> Setup your config file -- in the root directory edit the json file template_input.json. For the purpose of this program, you only need to update the values for `accountid` and `querykey`.

| Element          | Description                                         |
| ---------------- | --------------------------------------------------- |
| accountid        | NewRelic account ID                                 |
| querykey         | NewRelic Insights Query key                         |
| basequery        | Base query to issue                                 |
| querystart       | Start date of query in format "YYYY-MM-DD"          |
| queryend         | End date of query in format "YYYY-MM-DD"            | 
| slicesizeminutes | The number of minutes to make each iteration        | 
| querysuffix      | What to append to query, (e.g. timeseries)          |


The `basequery` has a WHERE clause that has been parameterized:

> "SELECT count(*) from NrDailyUsage where productLine = 'APM' and usageType = 'Application' and apmLanguage = 'java' facet  consumingAccountName,apmAppName,apmAgentVersion WHERE consumingAccountName=?"

The values for the `consumingAccountName` will be coming from the results of `accountquery`:

> "SELECT uniques(consumingAccountName) FROM NrDailyUsage"

## Usage
> To run, execute nodejs against the main file index.js.  (e.g. ```node index.js```). 

The data report is written as a csv file (`java-agents.csv`) delimited by pipe (`|`) in the `output` directory.
