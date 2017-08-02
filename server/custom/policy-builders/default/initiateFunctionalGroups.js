const functionalGroupDataObj = require('./functionalGroupData.js').functionalGroupDataObj;

module.exports = {
    createDefaultFunctionalGroups: createDefaultFunctionalGroups,
    generatePermissions: generatePermissions,
    editAppPolicy: editAppPolicy
};

function createDefaultFunctionalGroups () {
    let functionGroupInfos = [];
    for (let prop in functionalGroupDataObj) {
        functionGroupInfos.push(defineFunctionGroupInfo(prop, functionalGroupDataObj[prop].userConsentPrompt));
    }
    return functionGroupInfos;
}

function defineFunctionGroupInfo (propertyName, userConsentPrompt) {
    let obj = {
        property_name: propertyName
    };
    if (userConsentPrompt !== undefined && userConsentPrompt !== null) {
        obj.user_consent_prompt = userConsentPrompt;
    }
    return obj;
}

function editAppPolicy (appPolicy, appObj) {
    //permissions are located in properties 'rpcPermissions' and 'vehiclePermissions' in appObj
    let vehiclePermissionSet = {};

    //handle vehiclePermissions
    const rpcGroupsToCheck = ["Location-1", "DrivingCharacteristics-3", "VehicleInfo-3", "Emergency-1"];

    for (let i = 0; i < appObj.vehiclePermissions.length; i++) {
        //given a permission name, get the functionalGroup that holds that permission
        const permName = appObj.vehiclePermissions[i];

        for (let j = 0; j < rpcGroupsToCheck.length; j++) {
            const permissions = functionalGroupDataObj[rpcGroupsToCheck[j]].getPermissionsFunc()[1];
            if (permissions.indexOf(permName) !== -1) {
                vehiclePermissionSet[rpcGroupsToCheck[j]] = null;
                //end loop early
                j = rpcGroupsToCheck.length;
            }            
        }
    }

    //apply the permissions found
    for (let prop in vehiclePermissionSet) {
        appPolicy.groups.push(prop);
    }

    let rpcPermissionSet = {};

    //handle rpc permissions
    const vehicleGroupsToCheck = ["Base-4", "ProprietaryData-3", "Navigation-1", "Base-6", "OnKeyboardInputOnlyGroup", 
        "OnTouchEventOnlyGroup", "DiagnosticMessageOnly", "SendLocation", "WayPoints", "BackgroundAPT"];

    for (let i = 0; i < appObj.rpcPermissions.length; i++) {
        //given a permission name, get the functionalGroup that holds that permission
        const permName = appObj.rpcPermissions[i];

        for (let j = 0; j < vehicleGroupsToCheck.length; j++) {
            const permissions = functionalGroupDataObj[vehicleGroupsToCheck[j]].getPermissionsFunc()[0];
            if (permissions.indexOf(permName) !== -1) {
                rpcPermissionSet[vehicleGroupsToCheck[j]] = null;
                //end loop early
                j = vehicleGroupsToCheck.length;
            }            
        }
    }

    // Specific check for the notification permission group
    if (appObj.can_background_alert) {
        rpcPermissionSet["Notifications"] = null;
    }

    //apply the permissions found
    for (let prop in rpcPermissionSet) {
        appPolicy.groups.push(prop);
    }    
    return appPolicy;
}

function generatePermissions () {
    let rpcPermissionObjs = [];
    let vehiclePermissionObjs = [];

    for (let functionalGroupName in functionalGroupDataObj) {
        const associatedPerms = functionalGroupDataObj[functionalGroupName].getPermissionsFunc();
        const permissionsArray = addPermissionsTemplate(associatedPerms[0], associatedPerms[1], functionalGroupName);

        rpcPermissionObjs = rpcPermissionObjs.concat(permissionsArray[0]);
        vehiclePermissionObjs = vehiclePermissionObjs.concat(permissionsArray[1]);
    }
    return {
        rpcPermissions: rpcPermissionObjs,
        vehiclePermissions: vehiclePermissionObjs
    };
}

function addPermissionsTemplate (addRpcArray, addVehicleArray, functionalGroupName) {
    let rpcPermissions = [];
    let vehicleDataPermissions = [];
    for (let i = 0; i < addRpcArray.length; i++) {
        rpcPermissions.push(addRpcPermission(addRpcArray[i], functionalGroupName));
    }
    for (let i = 0; i < addVehicleArray.length; i++) {
        if (addVehicleArray[i] !== "vin") {
            vehicleDataPermissions.push(addVehiclePermission('OnVehicleData', addVehicleArray[i], functionalGroupName));
            vehicleDataPermissions.push(addVehiclePermission('GetVehicleData', addVehicleArray[i], functionalGroupName));
            vehicleDataPermissions.push(addVehiclePermission('SubscribeVehicleData', addVehicleArray[i], functionalGroupName));
            vehicleDataPermissions.push(addVehiclePermission('UnsubscribeVehicleData', addVehicleArray[i], functionalGroupName));
        }
        else {
            //vin only makes sense to be associated with a "GetVehicleData" RPC
            vehicleDataPermissions.push(addVehiclePermission('GetVehicleData', addVehicleArray[i], functionalGroupName));
        }

    }
    return [rpcPermissions, vehicleDataPermissions];
}

function addRpcPermission (rpcName, functionalGroupName) {
    return {
        functionalGroupName: functionalGroupName,
        rpcName: rpcName
    };
}

function addVehiclePermission (rpcName, vehicleName, functionalGroupName) {
    return {
        functionalGroupName: functionalGroupName,
        rpcName: rpcName,
        vehicleName: vehicleName
    };
}