const app = require('../app');
const model = require('./model.js');
const setupSqlCommand = app.locals.db.setupSqlCommand;
const sql = require('./sql.js');
const funcGroupSql = require('../groups/sql.js');
const messagesSql = require('../messages/sql.js');

//validation functions

function validateCorePost (req, res) {
    if (!req.body.policy_table) {
        return res.errorMsg = "Please provide policy table information";
    } else if (!req.body.policy_table.app_policies) {
        return res.errorMsg = "Please provide app policies information";
    } else if (!req.body.policy_table.consumer_friendly_messages) {
        return res.errorMsg = "Please provide consumer friendly messages information";
    } else if (!req.body.policy_table.device_data) {
        return res.errorMsg = "Please provide device data information";
    } else if (!req.body.policy_table.functional_groupings) {
        return res.errorMsg = "Please provide functional groupings information";
    } else if (!req.body.policy_table.module_config) {
        return res.errorMsg = "Please provide module config information";
    } else if (!req.body.policy_table.usage_and_error_counts) {
        return res.errorMsg = "Please provide usage and error counts information";
    }
}

function validateAppPolicyOnlyPost (req, res) {
    if (!req.body.policy_table) {
        return res.errorMsg = "Please provide policy table information";
    } else if (!req.body.policy_table.app_policies) {
        return res.errorMsg = "Please provide app policies information";
    }
}


//helper functions

function generatePolicyTable (isProduction, appPolicyObj, returnPreview, cb) {
    let makePolicyTable = [];
    if (returnPreview) {
        makePolicyTable.push(setupModuleConfig(isProduction));
        makePolicyTable.push(setupFunctionalGroups(isProduction));
        makePolicyTable.push(setupConsumerFriendlyMessages(isProduction));
    }
    if (appPolicyObj) { //existence of appPolicyObj implies to return the app policy object
        makePolicyTable.push(setupAppPolicies(isProduction, appPolicyObj));
    }
    const policyTableMakeFlow = app.locals.flow(makePolicyTable, {method: 'parallel', eventLoop: true});
    policyTableMakeFlow(cb);
}

function setupModuleConfig (isProduction) {
    const getModuleConfig = [
        setupSqlCommand.bind(null, sql.moduleConfigInfo),
        setupSqlCommand.bind(null, sql.moduleConfigRetrySeconds)
    ];
    const moduleConfigGetFlow = app.locals.flow(getModuleConfig, {method: 'parallel'});
    const makeModuleConfig = [
        moduleConfigGetFlow,
        model.moduleConfigSkeleton(isProduction),
        model.constructModuleConfigObj
    ];
    return app.locals.flow(makeModuleConfig, {method: 'waterfall'});    
}

function setupConsumerFriendlyMessages (isProduction) {
    const getMessages = app.locals.flow({
        messageStatuses: setupSqlCommand.bind(null, messagesSql.getMessages.status(isProduction)),
        messageGroups: setupSqlCommand.bind(null, messagesSql.getMessages.group(isProduction, false, true))
    }, {method: 'parallel'});

    const makeMessages = [
        getMessages,
        model.messagesSkeleton
    ];

    return app.locals.flow(makeMessages, {method: 'waterfall'});
}

function setupFunctionalGroups (isProduction) {
    const getFunctionGroupInfo = [
        setupSqlCommand.bind(null, funcGroupSql.getFuncGroup.base.statusFilter(isProduction, true)),
        setupSqlCommand.bind(null, funcGroupSql.getFuncGroup.hmiLevels.statusFilter(isProduction, true)),
        setupSqlCommand.bind(null, funcGroupSql.getFuncGroup.parameters.statusFilter(isProduction, true))
    ];
    const funcGroupGetFlow = app.locals.flow(getFunctionGroupInfo, {method: 'parallel'});
    const makeFunctionGroupInfo = [
        funcGroupGetFlow,
        model.functionGroupSkeleton,
        model.constructFunctionGroupObj
    ];
    return app.locals.flow(makeFunctionGroupInfo, {method: 'waterfall'});
}

function setupAppPolicies (isProduction, reqAppPolicy) {
    const uuids = Object.keys(reqAppPolicy);
    const getAppPolicy = [
        setupSqlCommand.bind(null, sql.getBaseAppInfo(isProduction, uuids)),
        mapAppBaseInfo(isProduction)
    ];
    const getAppInfoBaseFlow = app.locals.flow(getAppPolicy, {method: 'waterfall'});
    return getAppInfoBaseFlow;
}

function mapAppBaseInfo (isProduction) {
    return function (appObjs, next) {
        const makeFlowArray = appObjs.map(function (appObj) {
            const getAppInfo = [
                setupSqlCommand.bind(null, sql.getAppDisplayNames(appObj.id)),
                setupSqlCommand.bind(null, sql.getAppModules(appObj.id)),
                setupSqlCommand.bind(null, sql.getAppFunctionalGroups(isProduction, appObj)),
                function (next) {
                    next(null, appObj);
                }
            ];
            const getFlow = app.locals.flow(getAppInfo, {method: 'parallel'});
            const makeFlow = app.locals.flow([getFlow, model.constructAppPolicy], {method: 'waterfall'});
            return makeFlow;
        });

        const parallelMakeFlow = app.locals.flow(makeFlowArray, {method: 'parallel'});
        const finalFlow = app.locals.flow([parallelMakeFlow, model.aggregateResults], {method: 'waterfall'});
        finalFlow(function (err, res) {
            next(err, res);
        });
    }
}

module.exports = {
    validateCorePost: validateCorePost,
    validateAppPolicyOnlyPost: validateAppPolicyOnlyPost,
    generatePolicyTable: generatePolicyTable,
    validateCorePost: validateCorePost,
    validateCorePost: validateCorePost,
}